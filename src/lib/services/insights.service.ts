import type { AIInsightView } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { buildClinicInsights } from "@/lib/insights/build-insights";
import { getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapAppointmentRow, mapCallRow, mapLeadRow } from "@/lib/supabase/mappers";

const INSIGHT_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Live Mode reads the last 60 days of calls, leads, and appointments and
 * writes operational notes from those counts. Demo Mode keeps the sample insights.
 */
export async function getAIInsights(): Promise<AIInsightView[]> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const since = new Date(Date.now() - INSIGHT_WINDOW_MS).toISOString();
    const [callsRes, leadsRes, appointmentsRes] = await Promise.all([
      supabase.from("calls").select("*").gte("started_at", since),
      supabase.from("leads").select("*").gte("created_at", since),
      supabase.from("appointments").select("*").gte("starts_at", since),
    ]);
    if (callsRes.error) throw callsRes.error;
    if (leadsRes.error) throw leadsRes.error;
    if (appointmentsRes.error) throw appointmentsRes.error;

    const now = new Date();
    return buildClinicInsights(
      {
        calls: (callsRes.data ?? []).map(mapCallRow),
        leads: (leadsRes.data ?? []).map(mapLeadRow),
        appointments: (appointmentsRes.data ?? []).map(mapAppointmentRow),
      },
      now
    ).map((insight) => ({
      id: insight.title,
      category: insight.category,
      severity: insight.severity,
      title: insight.title,
      description: insight.description,
      recommendation: insight.recommendation,
      metric: insight.metric,
      metricValue: insight.metricValue,
      createdAt: "Last 30 days",
    }));
  }
  const { insights } = getMockDataset();
  return insights
    .filter((i) => i.status !== "dismissed")
    .map((i) => ({
      id: i.id,
      category: i.category,
      severity: i.severity,
      title: i.title,
      description: i.description,
      recommendation: i.recommendation,
      metric: i.metric,
      metricValue: i.metric_value,
      createdAt: formatRelativeTime(i.created_at),
    }));
}
