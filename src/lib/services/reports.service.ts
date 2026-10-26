import type { DateRange } from "@/types";
import { isWithinRange } from "@/lib/date-range";
import { formatCurrency } from "@/lib/format";
import { getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapAppointmentRow, mapCallRow, mapLeadRow } from "@/lib/supabase/mappers";

export type ReportPeriod = "daily" | "weekly" | "monthly";

export interface GeneratedReport {
  period: ReportPeriod;
  range: DateRange;
  generatedAt: string;
  executiveSummary: string;
  keyOpportunities: string[];
  stats: {
    totalCalls: number;
    qualifiedLeads: number;
    appointmentsBooked: number;
    missedCalls: number;
    recovered: number;
    estimatedRevenue: number;
  };
}

async function loadReportSource(range: DateRange) {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const [callsResult, leadsResult, appointmentsResult, followUpResult] = await Promise.all([
      supabase.from("calls").select("*").gte("started_at", range.from).lte("started_at", range.to),
      supabase.from("leads").select("*").gte("created_at", range.from).lte("created_at", range.to),
      supabase.from("appointments").select("*").gte("created_at", range.from).lte("created_at", range.to),
      supabase.from("patients").select("id", { count: "exact", head: true }).in("status", ["overdue_recall", "needs_follow_up"]),
    ]);
    if (callsResult.error) throw new Error(callsResult.error.message);
    if (leadsResult.error) throw new Error(leadsResult.error.message);
    if (appointmentsResult.error) throw new Error(appointmentsResult.error.message);
    if (followUpResult.error) throw new Error(followUpResult.error.message);
    return {
      calls: (callsResult.data ?? []).map(mapCallRow),
      leads: (leadsResult.data ?? []).map(mapLeadRow),
      appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
      followUpPatients: followUpResult.count ?? 0,
    };
  }

  const mock = getMockDataset();
  return {
    calls: mock.calls.filter((call) => isWithinRange(call.started_at, range.from, range.to)),
    leads: mock.leads.filter((lead) => isWithinRange(lead.created_at, range.from, range.to)),
    appointments: mock.appointments.filter((appointment) => isWithinRange(appointment.created_at, range.from, range.to)),
    followUpPatients: mock.patients.filter((patient) => patient.status === "overdue_recall" || patient.status === "needs_follow_up").length,
  };
}

export async function generateReport(period: ReportPeriod, range: DateRange): Promise<GeneratedReport> {
  const { calls, leads, appointments, followUpPatients } = await loadReportSource(range);

  const qualifiedLeads = leads.filter((lead) => lead.status !== "new" && lead.status !== "lost").length;
  const booked = appointments.filter((appointment) => appointment.status === "confirmed" || appointment.status === "completed");
  const missed = calls.filter((call) => call.status === "missed");
  const recovered = missed.filter((call) => call.recovered_from_missed);
  const estimatedRevenue = booked.reduce((sum, appointment) => sum + appointment.estimated_value, 0);
  const unbookedImplantLeads = leads.filter((lead) => lead.service === "implants" && lead.status !== "booked" && lead.status !== "completed" && lead.status !== "lost").length;
  const mondayMissed = missed.filter((call) => new Date(call.started_at).getDay() === 1).length;

  const opportunities: string[] = [];
  if (mondayMissed > 0) opportunities.push(`Improve Monday call coverage. ${mondayMissed} missed call${mondayMissed === 1 ? "" : "s"} landed on a Monday.`);
  if (unbookedImplantLeads > 0) opportunities.push(`Follow up with ${unbookedImplantLeads} unbooked implant lead${unbookedImplantLeads === 1 ? "" : "s"}.`);
  if (followUpPatients > 0) opportunities.push(`Reactivate ${followUpPatients} patient${followUpPatients === 1 ? "" : "s"} who need a follow-up or are overdue for recall.`);
  if (recovered.length > 0) opportunities.push(`${recovered.length} missed call${recovered.length === 1 ? " was" : "s were"} marked recovered.`);
  if (opportunities.length === 0) opportunities.push("No urgent opportunities showed up for this period.");

  const periodLabel = period === "daily" ? "today" : period === "weekly" ? "this week" : "this month";

  return {
    period,
    range,
    generatedAt: new Date().toISOString(),
    executiveSummary: `Your clinic received ${calls.length} call${calls.length === 1 ? "" : "s"} ${periodLabel}, generated ${qualifiedLeads} qualified inquir${qualifiedLeads === 1 ? "y" : "ies"}, and booked ${booked.length} appointment${booked.length === 1 ? "" : "s"}, for an estimated revenue opportunity of ${formatCurrency(estimatedRevenue)}.`,
    keyOpportunities: opportunities,
    stats: {
      totalCalls: calls.length,
      qualifiedLeads,
      appointmentsBooked: booked.length,
      missedCalls: missed.length,
      recovered: recovered.length,
      estimatedRevenue,
    },
  };
}
