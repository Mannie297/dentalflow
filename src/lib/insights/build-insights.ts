import { DENTAL_SERVICE_LABELS, type DentalServiceType, type InsightCategory, type InsightSeverity } from "@/types";

export interface ClinicInsight {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  recommendation: string;
  metric: string;
  metricValue: string;
}

export interface InsightSource {
  calls: { started_at: string; status: string; recovered_from_missed?: boolean }[];
  leads: { created_at: string; service: string; status: string; estimated_value: number }[];
  appointments: { starts_at: string; status: string }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BOOKED = new Set(["booked", "completed"]);

/**
 * Operational notes from clinic activity over the last 30 days, compared with
 * the 30 days before that. Counts come from the rows passed in.
 */
export function buildClinicInsights(source: InsightSource, now = new Date()): ClinicInsight[] {
  const currentFrom = now.getTime() - 30 * DAY_MS;
  const priorFrom = now.getTime() - 60 * DAY_MS;
  const calls = source.calls.filter((row) => inWindow(row.started_at, currentFrom, now.getTime()));
  const leads = source.leads.filter((row) => inWindow(row.created_at, currentFrom, now.getTime()));
  const appointments = source.appointments.filter((row) => inWindow(row.starts_at, currentFrom, now.getTime()));
  if (calls.length + leads.length + appointments.length === 0) return [];

  const insights: ClinicInsight[] = [];
  const missed = calls.filter((row) => row.status === "missed");
  const unrecovered = missed.filter((row) => !row.recovered_from_missed);

  insights.push({
    category: "operations",
    severity: missed.length > 0 ? "information" : "opportunity",
    title: missed.length > 0 ? `${missed.length} missed calls in the last 30 days` : "No missed calls in the last 30 days",
    description: `${calls.length} calls, ${leads.length} leads, and ${appointments.length} appointments in the last 30 days.`,
    recommendation:
      unrecovered.length > 0
        ? "Each missed inbound call is called back by voice a few minutes later. Open Missed Call Recovery to see those callbacks."
        : "Keep the receptionist answering live calls so this stretch continues.",
    metric: "Missed calls",
    metricValue: String(missed.length),
  });

  const monday = rate(calls.filter((row) => weekday(row.started_at) === "Mon"));
  const other = rate(calls.filter((row) => weekday(row.started_at) !== "Mon"));
  if (monday.total >= 3 && other.total >= 3 && monday.rate - other.rate > 2) {
    insights.push({
      category: "calls",
      severity: "warning",
      title: "Mondays have a higher missed-call rate",
      description: `Monday calls were missed ${monday.rate.toFixed(1)}% of the time, compared with ${other.rate.toFixed(1)}% on other days.`,
      recommendation: "Keep the receptionist on through Monday so more of those callers get through.",
      metric: "Monday missed rate",
      metricValue: `${monday.rate.toFixed(1)}%`,
    });
  }

  const emergency = bookingRate(leads.filter((row) => row.service === "emergency_dental"));
  const cleaning = bookingRate(leads.filter((row) => row.service === "general_cleaning"));
  if (emergency.total >= 2 && cleaning.total >= 2 && emergency.rate - cleaning.rate > 5) {
    insights.push({
      category: "conversion",
      severity: "opportunity",
      title: "Emergency inquiries book more often than cleanings",
      description: `${emergency.rate.toFixed(0)}% of emergency inquiries are booked, compared with ${cleaning.rate.toFixed(0)}% of cleaning inquiries.`,
      recommendation: "Follow up cleaning inquiries the same day so they get the same attention as emergency calls.",
      metric: "Cleaning booking rate",
      metricValue: `${cleaning.rate.toFixed(0)}%`,
    });
  }

  const unbookedImplants = leads.filter((row) => isImplant(row.service) && !BOOKED.has(row.status) && row.status !== "lost");
  if (unbookedImplants.length > 0) {
    insights.push({
      category: "patients",
      severity: "warning",
      title: `${unbookedImplants.length} implant ${unbookedImplants.length === 1 ? "inquiry has" : "inquiries have"} no booked visit`,
      description: "These implant inquiries are still open.",
      recommendation: "Call those patients back and offer an implant consult.",
      metric: "Open implant inquiries",
      metricValue: String(unbookedImplants.length),
    });
  }

  const byService = new Map<string, number>();
  for (const lead of leads) {
    if (lead.estimated_value <= 0 || lead.service === "other") continue;
    byService.set(lead.service, (byService.get(lead.service) ?? 0) + lead.estimated_value);
  }
  const top = [...byService.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const label = serviceLabel(top[0]);
    insights.push({
      category: "revenue",
      severity: "opportunity",
      title: `${label} is the largest estimated opportunity`,
      description: `${label} inquiries account for the highest estimated value in the last 30 days.`,
      recommendation: `When someone asks about ${label.toLowerCase()}, offer the next open visit.`,
      metric: "Estimated value",
      metricValue: `$${Math.round(top[1]).toLocaleString("en-CA")}`,
    });
  }

  const priorAppointments = source.appointments.filter((row) => inWindow(row.starts_at, priorFrom, currentFrom));
  const currentCancel = cancelRate(appointments);
  const priorCancel = cancelRate(priorAppointments);
  if (appointments.length >= 2 && priorAppointments.length >= 2 && priorCancel > 0 && currentCancel > priorCancel) {
    insights.push({
      category: "appointments",
      severity: currentCancel - priorCancel > 15 ? "warning" : "information",
      title: "Appointment cancellations are higher than the previous 30 days",
      description: `${currentCancel.toFixed(1)}% of appointments in the last 30 days were cancelled, compared with ${priorCancel.toFixed(1)}% in the previous 30 days.`,
      recommendation: "Confirm upcoming visits the day before so patients can keep or reschedule them.",
      metric: "Cancellation rate",
      metricValue: `${currentCancel.toFixed(1)}%`,
    });
  }

  return insights.slice(0, 5);
}

function inWindow(iso: string, from: number, to: number): boolean {
  const time = new Date(iso).getTime();
  return time >= from && time <= to;
}

function weekday(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", weekday: "short" }).format(new Date(iso));
}

function rate(calls: { status: string }[]): { total: number; rate: number } {
  const missed = calls.filter((row) => row.status === "missed").length;
  return { total: calls.length, rate: calls.length > 0 ? (missed / calls.length) * 100 : 0 };
}

function bookingRate(leads: { status: string }[]): { total: number; rate: number } {
  const booked = leads.filter((row) => BOOKED.has(row.status)).length;
  return { total: leads.length, rate: leads.length > 0 ? (booked / leads.length) * 100 : 0 };
}

function cancelRate(appointments: { status: string }[]): number {
  if (appointments.length === 0) return 0;
  return (appointments.filter((row) => row.status === "cancelled").length / appointments.length) * 100;
}

function serviceLabel(service: string): string {
  if (service in DENTAL_SERVICE_LABELS) return DENTAL_SERVICE_LABELS[service as DentalServiceType];
  return service;
}

function isImplant(service: string): boolean {
  return service === "implants" || service.toLowerCase().includes("implant");
}
