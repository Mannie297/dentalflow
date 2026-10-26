import type { Appointment, Call, Campaign, CampaignPerformanceView, DateRange, DentalServiceType, Lead, LeadSource } from "@/types";
import { LEAD_SOURCE_LABELS } from "@/types";
import { isWithinRange } from "@/lib/date-range";
import { formatCurrency, formatDate } from "@/lib/format";
import { getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapAppointmentRow, mapCallRow, mapLeadRow } from "@/lib/supabase/mappers";
import { getCampaigns } from "./campaigns.service";
import { computeCallActivity, computeServicePerformance, type MetricsDataset } from "./metrics";

export interface AnalyticsFilters {
  service?: DentalServiceType;
  source?: LeadSource;
  campaignId?: string;
  dentist?: string;
}

export interface AnalyticsMetricCard {
  key: string;
  label: string;
  value: string;
  helpText: string;
}

export interface LeadSourceBreakdown {
  source: LeadSource;
  label: string;
  count: number;
  percent: number;
}

export interface AnalyticsFilterOptions {
  services: DentalServiceType[];
  sources: LeadSource[];
  campaigns: { id: string; name: string }[];
  dentists: string[];
}

export interface AnalyticsOverview {
  metrics: AnalyticsMetricCard[];
  callActivity: ReturnType<typeof computeCallActivity>;
  conversionTrend: { date: string; conversionRate: number }[];
  servicePerformance: ReturnType<typeof computeServicePerformance>;
  leadSources: LeadSourceBreakdown[];
  campaignPerformance: CampaignPerformanceView[];
  filterOptions: AnalyticsFilterOptions;
}

interface AnalyticsDataset extends MetricsDataset {
  campaigns: Campaign[];
}

function rate(part: number, whole: number): number {
  return whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0;
}

function inRange<T>(rows: T[], field: keyof T, range: DateRange): T[] {
  return rows.filter((row) => {
    const value = row[field];
    return typeof value === "string" && isWithinRange(value, range.from, range.to);
  });
}

function applyFilters(data: AnalyticsDataset, filters: AnalyticsFilters): AnalyticsDataset {
  let { calls, leads, appointments } = data;

  if (filters.campaignId) {
    calls = calls.filter((call) => call.campaign_id === filters.campaignId);
    leads = leads.filter((lead) => lead.campaign_id === filters.campaignId);
    appointments = appointments.filter((appointment) => appointment.campaign_id === filters.campaignId);
  }
  if (filters.source) {
    leads = leads.filter((lead) => lead.source === filters.source);
    const leadIds = new Set(leads.map((lead) => lead.id));
    calls = calls.filter((call) => call.lead_id != null && leadIds.has(call.lead_id));
    appointments = appointments.filter((appointment) => appointment.lead_id != null && leadIds.has(appointment.lead_id));
  }
  if (filters.service) {
    leads = leads.filter((lead) => lead.service === filters.service);
    appointments = appointments.filter((appointment) => appointment.service === filters.service);
    const leadIds = new Set(leads.map((lead) => lead.id));
    const appointmentIds = new Set(appointments.map((appointment) => appointment.id));
    calls = calls.filter(
      (call) =>
        (call.lead_id != null && leadIds.has(call.lead_id)) || (call.appointment_id != null && appointmentIds.has(call.appointment_id))
    );
  }
  if (filters.dentist) {
    appointments = appointments.filter((appointment) => appointment.dentist_name === filters.dentist);
    const appointmentIds = new Set(appointments.map((appointment) => appointment.id));
    calls = calls.filter((call) => call.appointment_id != null && appointmentIds.has(call.appointment_id));
    const leadIds = new Set(appointments.map((appointment) => appointment.lead_id).filter((id): id is string => Boolean(id)));
    leads = leads.filter((lead) => leadIds.has(lead.id));
  }

  const campaigns = filters.campaignId ? data.campaigns.filter((campaign) => campaign.id === filters.campaignId) : data.campaigns;
  return { calls, leads, appointments, campaigns };
}

function campaignPerformance(campaigns: Campaign[], calls: Call[], appointments: Appointment[]): CampaignPerformanceView[] {
  return campaigns.map((campaign) => {
    const relatedCalls = calls.filter((call) => call.campaign_id === campaign.id);
    const relatedAppointments = appointments.filter((appointment) => appointment.campaign_id === campaign.id && appointment.status !== "cancelled");
    const answered = relatedCalls.filter((call) => call.status === "completed" || call.status === "transferred").length;
    const revenue = relatedAppointments.reduce((sum, appointment) => sum + appointment.estimated_value, 0);
    return {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      contacts: campaign.contacts_count,
      calls: relatedCalls.length,
      answered,
      appointments: relatedAppointments.length,
      conversionRate: campaign.contacts_count > 0 ? rate(relatedAppointments.length, campaign.contacts_count) : 0,
      estimatedRevenue: revenue,
      status: campaign.status,
    };
  });
}

export function buildAnalyticsOverview(range: DateRange, data: AnalyticsDataset, filters: AnalyticsFilters = {}): AnalyticsOverview {
  const callsInRange = inRange(data.calls, "started_at", range);
  const leadsInRange = inRange(data.leads, "created_at", range);
  const appointmentsInRange = inRange(data.appointments, "created_at", range);
  const options: AnalyticsFilterOptions = {
    services: [...new Set([...leadsInRange.map((lead) => lead.service), ...appointmentsInRange.map((appointment) => appointment.service)])].sort(),
    sources: [...new Set(leadsInRange.map((lead) => lead.source))].sort(),
    campaigns: data.campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name })).sort((a, b) => a.name.localeCompare(b.name)),
    dentists: [...new Set(appointmentsInRange.map((appointment) => appointment.dentist_name).filter(Boolean))].sort(),
  };

  const filtered = applyFilters({ ...data, calls: callsInRange, leads: leadsInRange, appointments: appointmentsInRange }, filters);
  const { calls, leads, appointments, campaigns } = filtered;
  const dataset: MetricsDataset = { calls, leads, appointments };

  const answered = calls.filter((call) => call.status === "completed" || call.status === "transferred").length;
  const missed = calls.filter((call) => call.status === "missed").length;
  const qualified = leads.filter((lead) => lead.status !== "new" && lead.status !== "lost").length;
  const bookedLeads = leads.filter((lead) => lead.status === "booked" || lead.status === "completed").length;
  const finishedAppointments = appointments.filter((appointment) => appointment.status === "completed" || appointment.status === "no_show");
  const noShows = appointments.filter((appointment) => appointment.status === "no_show").length;
  const cancelled = appointments.filter((appointment) => appointment.status === "cancelled").length;
  const recallLeads = leads.filter((lead) => lead.source === "campaign" || lead.campaign_id);
  const recallBooked = recallLeads.filter((lead) => lead.status === "booked" || lead.status === "completed").length;
  const estimatedRevenue = appointments
    .filter((appointment) => appointment.status === "confirmed" || appointment.status === "completed")
    .reduce((sum, appointment) => sum + appointment.estimated_value, 0);

  const callActivity = computeCallActivity(range, dataset);
  const bookedByDay = new Map<string, { leads: number; booked: number }>();
  for (const point of callActivity.points) bookedByDay.set(point.date, { leads: 0, booked: 0 });
  for (const lead of leads) {
    const key = formatDate(lead.created_at);
    const entry = bookedByDay.get(key);
    if (!entry) continue;
    entry.leads += 1;
    if (lead.status === "booked" || lead.status === "completed") entry.booked += 1;
  }
  const conversionTrend = [...bookedByDay.entries()].map(([date, entry]) => ({
    date,
    conversionRate: rate(entry.booked, entry.leads),
  }));

  const totalLeads = leads.length || 1;
  const sourceCounts = new Map<LeadSource, number>();
  for (const lead of leads) sourceCounts.set(lead.source, (sourceCounts.get(lead.source) ?? 0) + 1);
  const leadSources = [...sourceCounts.entries()]
    .map(([source, count]) => ({
      source,
      label: LEAD_SOURCE_LABELS[source],
      count,
      percent: rate(count, totalLeads),
    }))
    .sort((a, b) => b.count - a.count);

  const metrics: AnalyticsMetricCard[] = [
    { key: "call_volume", label: "Call volume", value: calls.length.toLocaleString("en-CA"), helpText: "Inbound and outbound calls in this range" },
    { key: "answer_rate", label: "Answer rate", value: `${rate(answered, calls.length).toFixed(1)}%`, helpText: "Calls that were completed or transferred" },
    { key: "missed_call_rate", label: "Missed call rate", value: `${rate(missed, calls.length).toFixed(1)}%`, helpText: "Calls marked missed" },
    { key: "lead_conversion", label: "Lead conversion", value: `${rate(bookedLeads, leads.length).toFixed(1)}%`, helpText: "Leads that reached booked or completed" },
    { key: "appointment_conversion", label: "Appointment conversion", value: `${rate(bookedLeads, qualified).toFixed(1)}%`, helpText: "Qualified leads that booked" },
    { key: "no_show_rate", label: "No-show rate", value: `${rate(noShows, finishedAppointments.length).toFixed(1)}%`, helpText: "Finished visits marked no-show" },
    { key: "cancellation_rate", label: "Cancellation rate", value: `${rate(cancelled, appointments.length).toFixed(1)}%`, helpText: "Appointments cancelled" },
    { key: "recall_conversion", label: "Recall conversion", value: `${rate(recallBooked, recallLeads.length).toFixed(1)}%`, helpText: "Campaign leads that booked" },
    { key: "campaign_roi", label: "Campaign ROI", value: "—", helpText: "Campaign cost is not recorded, so a return cannot be calculated" },
    { key: "estimated_revenue", label: "Estimated revenue", value: formatCurrency(estimatedRevenue), helpText: "Value of confirmed and completed appointments" },
  ];

  return {
    metrics,
    callActivity,
    conversionTrend,
    servicePerformance: computeServicePerformance(range, dataset),
    leadSources,
    campaignPerformance: campaignPerformance(campaigns, calls, appointments),
    filterOptions: options,
  };
}

async function loadAnalyticsDataset(range: DateRange): Promise<AnalyticsDataset> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const [callsResult, leadsResult, appointmentsResult, campaigns] = await Promise.all([
      supabase.from("calls").select("*").gte("started_at", range.from).lte("started_at", range.to),
      supabase.from("leads").select("*").gte("created_at", range.from).lte("created_at", range.to),
      supabase.from("appointments").select("*").gte("created_at", range.from).lte("created_at", range.to),
      getCampaigns(),
    ]);
    if (callsResult.error) throw new Error(callsResult.error.message);
    if (leadsResult.error) throw new Error(leadsResult.error.message);
    if (appointmentsResult.error) throw new Error(appointmentsResult.error.message);
    return {
      calls: (callsResult.data ?? []).map(mapCallRow),
      leads: (leadsResult.data ?? []).map(mapLeadRow),
      appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
      campaigns,
    };
  }

  const mock = getMockDataset();
  return { calls: mock.calls, leads: mock.leads, appointments: mock.appointments, campaigns: mock.campaigns };
}

export async function getAnalyticsOverview(range: DateRange, filters: AnalyticsFilters = {}): Promise<AnalyticsOverview> {
  return buildAnalyticsOverview(range, await loadAnalyticsDataset(range), filters);
}
