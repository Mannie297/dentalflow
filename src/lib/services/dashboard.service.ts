import type { ActivityItemView, DashboardSummary, DateRange } from "@/types";
import { getPreviousPeriod } from "@/lib/date-range";
import { formatRelativeTime } from "@/lib/format";
import { getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapAppointmentRow, mapCallRow, mapLeadRow } from "@/lib/supabase/mappers";
import { getAIInsights } from "./insights.service";
import { getCampaignPerformance } from "./campaigns.service";
import { getUpcomingAppointments } from "./appointments.service";
import { getLeadFunnel } from "./leads.service";
import {
  computeAppointmentFunnel,
  computeCallActivity,
  computeKPIs,
  computeMissedCallRecovery,
  computeServicePerformance,
  type MetricsDataset,
} from "./metrics";

const ACTIVITY_ICON_MAP: Record<string, ActivityItemView["icon"]> = {
  call_completed: "phone-incoming",
  call_missed: "phone-missed",
  call_recovered: "phone-incoming",
  appointment_booked: "calendar-check",
  appointment_reminder_sent: "message-square",
  appointment_cancelled: "calendar-x",
  lead_created: "user-plus",
  review_requested: "star",
  campaign_completed: "megaphone",
  patient_created: "user-plus",
  // automation_events.event_type values (Live Mode) -- see /docs/N8N_WORKFLOWS.md
  "lead.created": "user-plus",
  "lead.qualified": "user-plus",
  "appointment.created": "calendar-check",
  "appointment.cancelled": "calendar-x",
  "call.missed": "phone-missed",
  "call.completed": "phone-incoming",
};

const ACTIVITY_DESCRIPTION_MAP: Record<string, string> = {
  "lead.created": "New lead created",
  "lead.qualified": "Lead qualified by AI",
  "appointment.created": "Appointment booked",
  "appointment.cancelled": "Appointment cancelled",
  "call.missed": "Missed call",
  "call.completed": "Call completed",
};

function activityForEvent(eventType: string, payload: Record<string, unknown> | null): { icon: ActivityItemView["icon"]; description: string } {
  const outbound = payload?.direction === "outbound";
  if (eventType === "call.completed") {
    return {
      icon: outbound ? "phone-outgoing" : "phone-incoming",
      description: outbound ? "Outbound call completed" : "Inbound call completed",
    };
  }
  if (eventType === "call.missed") {
    return {
      icon: "phone-missed",
      description: outbound ? "Outbound call missed" : "Missed inbound call",
    };
  }
  return {
    icon: ACTIVITY_ICON_MAP[eventType] ?? "message-square",
    description: ACTIVITY_DESCRIPTION_MAP[eventType] ?? eventType,
  };
}

export async function getRecentActivity(limit = 8): Promise<ActivityItemView[]> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("automation_events")
      .select("*")
      .neq("event_type", "campaign.call_scheduled")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((e) => {
      const payload = e.payload && typeof e.payload === "object" && !Array.isArray(e.payload) ? (e.payload as Record<string, unknown>) : null;
      const activity = activityForEvent(e.event_type, payload);
      return {
      id: e.id,
      icon: activity.icon,
      description: activity.description,
      patientName: payload && "patient_name" in payload ? String(payload.patient_name) : null,
      timestamp: e.created_at,
      relativeTime: formatRelativeTime(e.created_at),
      status: e.status === "failed" ? "danger" : e.status === "completed" ? "success" : "info",
      };
    });
  }
  const { activity } = getMockDataset();
  return activity.slice(0, limit).map((a) => ({
    id: a.id,
    icon: ACTIVITY_ICON_MAP[a.type] ?? "message-square",
    description: a.description,
    patientName: a.patient_name,
    timestamp: a.created_at,
    relativeTime: formatRelativeTime(a.created_at),
    status: a.status,
  }));
}

/** Fetches calls/leads/appointments for [previousPeriod.from, range.to] so the same window covers both the current and comparison period in one round trip per table. */
async function fetchLiveMetricsDataset(range: DateRange): Promise<MetricsDataset> {
  const supabase = getSupabaseBrowserClient();
  const prev = getPreviousPeriod(range);
  const windowFrom = prev.from;
  const windowTo = range.to;

  const [callsRes, leadsRes, appointmentsRes] = await Promise.all([
    supabase.from("calls").select("*").gte("started_at", windowFrom).lte("started_at", windowTo),
    supabase.from("leads").select("*").gte("created_at", windowFrom).lte("created_at", windowTo),
    supabase.from("appointments").select("*").gte("created_at", windowFrom).lte("created_at", windowTo),
  ]);

  if (callsRes.error) throw callsRes.error;
  if (leadsRes.error) throw leadsRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;

  return {
    calls: (callsRes.data ?? []).map(mapCallRow),
    leads: (leadsRes.data ?? []).map(mapLeadRow),
    appointments: (appointmentsRes.data ?? []).map(mapAppointmentRow),
  };
}

/**
 * Assembles the full dashboard view-model for the given date range. This is
 * the single entry point the `/dashboard` page depends on -- all underlying
 * calculations live in `metrics.ts` (pure functions, shared between Demo Mode
 * and Live Mode) and sibling services.
 */
export async function getDashboardMetrics(range: DateRange): Promise<DashboardSummary> {
  const isLive = getCurrentDataSource() === "supabase";

  const dataset: MetricsDataset = isLive ? await fetchLiveMetricsDataset(range) : getMockDataset();

  const [leadFunnel, campaignPerformance, insights, upcomingAppointments, recentActivity] = await Promise.all([
    getLeadFunnel({ from: range.from, to: range.to }),
    getCampaignPerformance(),
    getAIInsights(),
    getUpcomingAppointments(6),
    getRecentActivity(8),
  ]);

  let clinicName = "DentalFlow AI";
  if (isLive) {
    const supabase = getSupabaseBrowserClient();
    const { data: org } = await supabase.from("organizations").select("name").limit(1).maybeSingle();
    if (org?.name) clinicName = org.name;
  } else {
    clinicName = getMockDataset().organization.name;
  }

  return {
    clinicName,
    ownerFirstName: "Sarah",
    kpis: computeKPIs(range, dataset),
    callActivity: computeCallActivity(range, dataset),
    appointmentFunnel: computeAppointmentFunnel(range, dataset),
    leadFunnel,
    servicePerformance: computeServicePerformance(range, dataset).slice(0, 6),
    missedCallRecovery: computeMissedCallRecovery(range, dataset),
    insights,
    recentActivity,
    upcomingAppointments,
    campaignPerformance,
  };
}
