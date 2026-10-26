/**
 * Shared aggregation logic used by both the dashboard and analytics
 * services. These are PURE functions over plain `Call[]`/`Lead[]`/
 * `Appointment[]` arrays -- they have no knowledge of where the data came
 * from, so the exact same calculations run unchanged against the mock
 * dataset (Demo Mode) or Supabase query results (Live Mode). This is the
 * single place each dashboard metric's definition lives -- see
 * /docs/SUPABASE_SCHEMA.md "Dashboard metric definitions" for the
 * human-readable version of each formula below.
 */
import type {
  Appointment,
  AppointmentConversionFunnel,
  Call,
  CallActivitySummary,
  DashboardKPIs,
  DateRange,
  Lead,
  MissedCallRecoveryStats,
  ServicePerformance,
} from "@/types";
import { calculateTrend, getPreviousPeriod, isWithinRange } from "@/lib/date-range";
import { formatCurrency, formatDate, formatDuration, formatNumber, formatPercent } from "@/lib/format";

export interface MetricsDataset {
  calls: Call[];
  leads: Lead[];
  appointments: Appointment[];
}

function trendValue(current: number, previous: number, isPositiveWhenUp = true) {
  const { changePercent, direction } = calculateTrend(current, previous);
  return { value: current, changePercent, direction, isPositiveWhenUp };
}

export function computeKPIs(range: DateRange, data: MetricsDataset): DashboardKPIs {
  const { calls, leads, appointments } = data;
  const prev = getPreviousPeriod(range);

  const inRange = calls.filter((c) => isWithinRange(c.started_at, range.from, range.to));
  const inPrevRange = calls.filter((c) => isWithinRange(c.started_at, prev.from, prev.to));

  const totalCalls = inRange.length;
  const totalCallsPrev = inPrevRange.length;

  const missed = inRange.filter((c) => c.status === "missed");
  const missedPrev = inPrevRange.filter((c) => c.status === "missed");
  const recoveredCount = missed.filter((c) => c.recovered_from_missed).length;

  const leadsInRange = leads.filter((l) => isWithinRange(l.created_at, range.from, range.to));
  const leadsInPrevRange = leads.filter((l) => isWithinRange(l.created_at, prev.from, prev.to));

  const apptsInRange = appointments.filter((a) => isWithinRange(a.created_at, range.from, range.to));
  const apptsInPrevRange = appointments.filter((a) => isWithinRange(a.created_at, prev.from, prev.to));
  // "Appointments booked" = appointments whose status is confirmed or completed (requested/cancelled/
  // no_show do not count as booked). See /docs/SUPABASE_SCHEMA.md.
  const booked = apptsInRange.filter((a) => a.status === "confirmed" || a.status === "completed");
  const bookedPrev = apptsInPrevRange.filter((a) => a.status === "confirmed" || a.status === "completed");
  const newPatientAppts = booked.filter((a) => a.patient_type === "new").length;

  // Conversion rate = appointments_booked / qualified_leads * 100, where "qualified leads" is every
  // lead that entered the pipeline this period (ties numerator and denominator to the same lead
  // population: leads that reached booked/completed vs. all leads created in-range). Returns 0 (not
  // NaN/Infinity) when there are no leads in the period.
  const bookedLeads = leadsInRange.filter((l) => l.status === "booked" || l.status === "completed").length;
  const bookedLeadsPrev = leadsInPrevRange.filter((l) => l.status === "booked" || l.status === "completed").length;
  const conversionRate = leadsInRange.length > 0 ? (bookedLeads / leadsInRange.length) * 100 : 0;
  const conversionRatePrev = leadsInPrevRange.length > 0 ? (bookedLeadsPrev / leadsInPrevRange.length) * 100 : 0;

  // Estimated revenue opportunity = SUM(estimated_value) of booked/completed appointments in range,
  // plus a flat per-recovered-missed-call estimate (missed calls that were followed up and recovered).
  const revenueOpportunity = booked.reduce((sum, a) => sum + a.estimated_value, 0) + recoveredCount * 500;
  const revenueOpportunityPrev =
    bookedPrev.reduce((sum, a) => sum + a.estimated_value, 0) + missedPrev.filter((c) => c.recovered_from_missed).length * 500;

  return {
    totalCalls: {
      key: "total_calls",
      label: "Total Calls",
      value: totalCalls,
      formattedValue: formatNumber(totalCalls),
      trend: trendValue(totalCalls, totalCallsPrev),
      subtext: "Inbound + outbound",
      href: "/calls",
      icon: "phone",
    },
    missedCalls: {
      key: "missed_calls",
      label: "Missed Calls",
      value: missed.length,
      formattedValue: formatNumber(missed.length),
      trend: trendValue(missed.length, missedPrev.length, false),
      subtext: `${recoveredCount} recovered`,
      href: "/calls?tab=missed",
      icon: "phone-missed",
    },
    newLeads: {
      key: "new_leads",
      label: "New Leads",
      value: leadsInRange.length,
      formattedValue: formatNumber(leadsInRange.length),
      trend: trendValue(leadsInRange.length, leadsInPrevRange.length),
      subtext: "From calls + web + chat",
      href: "/leads",
      icon: "users",
    },
    appointmentsBooked: {
      key: "appointments_booked",
      label: "Appointments Booked",
      value: booked.length,
      formattedValue: formatNumber(booked.length),
      trend: trendValue(booked.length, bookedPrev.length),
      subtext: `${newPatientAppts} new patients`,
      href: "/appointments",
      icon: "calendar-check",
    },
    conversionRate: {
      key: "conversion_rate",
      label: "Conversion Rate",
      value: conversionRate,
      formattedValue: formatPercent(conversionRate),
      trend: trendValue(conversionRate, conversionRatePrev),
      subtext: "Qualified inquiries that resulted in appointments",
      href: "/analytics",
      icon: "percent",
    },
    revenueOpportunity: {
      key: "revenue_opportunity",
      label: "Estimated Revenue Opportunity",
      value: revenueOpportunity,
      formattedValue: formatCurrency(revenueOpportunity),
      trend: trendValue(revenueOpportunity, revenueOpportunityPrev),
      subtext: "Based on booked/recovered opportunities",
      href: "/analytics",
      icon: "dollar-sign",
      isEstimate: true,
    },
  } satisfies DashboardKPIs;
}

export function computeCallActivity(range: DateRange, data: MetricsDataset): CallActivitySummary {
  const { calls } = data;
  const inRange = calls.filter((c) => isWithinRange(c.started_at, range.from, range.to));

  const byDay = new Map<string, { inbound: number; outbound: number; missed: number; answered: number }>();
  const from = new Date(range.from);
  const to = new Date(range.to);
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    byDay.set(formatDate(d.toISOString()), { inbound: 0, outbound: 0, missed: 0, answered: 0 });
  }

  let totalAnswered = 0;
  let totalMissed = 0;
  let totalOutbound = 0;
  let totalDuration = 0;
  let completedCount = 0;

  for (const call of inRange) {
    const key = formatDate(call.started_at);
    const entry = byDay.get(key) ?? { inbound: 0, outbound: 0, missed: 0, answered: 0 };
    if (call.direction === "inbound") entry.inbound += 1;
    else {
      entry.outbound += 1;
      totalOutbound += 1;
    }
    if (call.status === "missed") {
      entry.missed += 1;
      totalMissed += 1;
    } else {
      entry.answered += 1;
      totalAnswered += 1;
      if (call.status === "completed") {
        totalDuration += call.duration_seconds;
        completedCount += 1;
      }
    }
    byDay.set(key, entry);
  }

  const points = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));

  return {
    points,
    totalAnswered,
    totalMissed,
    totalOutbound,
    // Average call duration = SUM(duration_seconds) / number of completed (answered) calls. Returns 0,
    // not NaN, when there are no completed calls in range.
    averageDurationSeconds: completedCount > 0 ? Math.round(totalDuration / completedCount) : 0,
  };
}

export function computeAppointmentFunnel(range: DateRange, data: MetricsDataset): AppointmentConversionFunnel {
  const { calls, leads, appointments } = data;
  const inquiries = calls.filter((c) => isWithinRange(c.started_at, range.from, range.to) && c.status !== "missed").length;
  const leadsInRange = leads.filter((l) => isWithinRange(l.created_at, range.from, range.to));
  const qualified = leadsInRange.filter((l) => !["new", "lost"].includes(l.status)).length;
  const requested = leadsInRange.filter((l) => ["appointment_requested", "booked", "completed"].includes(l.status)).length;
  const apptsInRange = appointments.filter((a) => isWithinRange(a.created_at, range.from, range.to));
  const booked = apptsInRange.filter((a) => ["confirmed", "completed"].includes(a.status)).length;
  const completed = apptsInRange.filter((a) => a.status === "completed").length;

  const first = inquiries || 1;
  const steps = [
    { key: "inquiries", label: "Calls / Inquiries", count: inquiries },
    { key: "qualified", label: "Qualified Leads", count: qualified },
    { key: "requested", label: "Appointment Requested", count: requested },
    { key: "booked", label: "Appointment Booked", count: booked },
    { key: "completed", label: "Appointment Completed", count: completed },
  ];

  return {
    steps: steps.map((s, i) => ({
      ...s,
      percentOfFirst: Number(((s.count / first) * 100).toFixed(1)),
      percentOfPrevious: i === 0 ? null : Number(((s.count / (steps[i - 1].count || 1)) * 100).toFixed(1)),
    })),
  };
}

export function computeServicePerformance(range: DateRange, data: MetricsDataset): ServicePerformance[] {
  const { leads } = data;
  const leadsInRange = leads.filter((l) => isWithinRange(l.created_at, range.from, range.to));
  const byService = new Map<string, { leads: number; appointments: number; value: number }>();

  for (const lead of leadsInRange) {
    const entry = byService.get(lead.service) ?? { leads: 0, appointments: 0, value: 0 };
    entry.leads += 1;
    if (["booked", "completed"].includes(lead.status)) {
      entry.appointments += 1;
      entry.value += lead.estimated_value;
    }
    byService.set(lead.service, entry);
  }

  return [...byService.entries()]
    .map(([service, v]) => ({
      service: service as ServicePerformance["service"],
      leads: v.leads,
      appointments: v.appointments,
      conversionRate: v.leads > 0 ? Number(((v.appointments / v.leads) * 100).toFixed(1)) : 0,
      estimatedValue: v.value,
    }))
    .sort((a, b) => b.estimatedValue - a.estimatedValue);
}

export function computeMissedCallRecovery(range: DateRange, data: MetricsDataset): MissedCallRecoveryStats {
  const { calls } = data;
  const missedInRange = calls.filter((c) => isWithinRange(c.started_at, range.from, range.to) && c.status === "missed");
  const recovered = missedInRange.filter((c) => c.recovered_from_missed);
  const recoveredWithAppointment = recovered.filter((c) => c.appointment_id).length;
  const estimatedRevenueRecovered = recoveredWithAppointment * 900 + (recovered.length - recoveredWithAppointment) * 150;

  const byDay = new Map<string, { missed: number; recovered: number }>();
  for (const call of missedInRange) {
    const key = formatDate(call.started_at);
    const entry = byDay.get(key) ?? { missed: 0, recovered: 0 };
    entry.missed += 1;
    if (call.recovered_from_missed) entry.recovered += 1;
    byDay.set(key, entry);
  }

  return {
    missedCalls: missedInRange.length,
    recovered: recovered.length,
    appointmentsBooked: recoveredWithAppointment,
    estimatedRevenueRecovered,
    recoveryRate: missedInRange.length > 0 ? Number(((recovered.length / missedInRange.length) * 100).toFixed(1)) : 0,
    trend: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
  };
}

export function formatCallDuration(seconds: number): string {
  return formatDuration(seconds);
}

export type { Call };
