import type { CallStatus } from "@/types";
import { formatDuration } from "@/lib/format";
import { getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAIReceptionistSettings } from "@/lib/services/settings.service";

export interface AIReceptionistCall {
  id: string;
  phone: string;
  status: CallStatus;
  outcome: string | null;
  started_at: string;
  ai_handled: boolean;
}

export interface AIReceptionistStats {
  status: "online" | "offline";
  callsToday: number;
  callsHandled: number;
  appointmentsBooked: number;
  averageCallDuration: string;
  bookingConversion: number;
  calls: AIReceptionistCall[];
}

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function getAIReceptionistStats(): Promise<AIReceptionistStats> {
  const settings = await getAIReceptionistSettings();
  const start = startOfToday();
  const calls = await loadTodaysCalls(start);
  const handled = calls.filter((call) => call.ai_handled && call.status !== "missed" && call.status !== "failed");
  const booked = handled.filter((call) => call.outcome === "booked");
  const totalDuration = handled.reduce((sum, call) => sum + call.duration_seconds, 0);

  return {
    status: settings.enabled ? "online" : "offline",
    callsToday: calls.length,
    callsHandled: handled.length,
    appointmentsBooked: booked.length,
    averageCallDuration: handled.length > 0 ? formatDuration(totalDuration / handled.length) : "0m 00s",
    bookingConversion: handled.length > 0 ? Number(((booked.length / handled.length) * 100).toFixed(1)) : 0,
    calls: calls.slice(0, 8).map((call) => ({
      id: call.id,
      phone: call.phone_number,
      status: call.status,
      outcome: call.outcome,
      started_at: call.started_at,
      ai_handled: call.ai_handled,
    })),
  };
}

async function loadTodaysCalls(start: Date): Promise<{ id: string; phone_number: string; status: CallStatus; outcome: string | null; started_at: string; ai_handled: boolean; duration_seconds: number }[]> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("calls")
      .select("id, phone_number, status, outcome, started_at, ai_handled, duration_seconds")
      .gte("started_at", start.toISOString())
      .order("started_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((call) => ({
      id: call.id,
      phone_number: call.phone_number,
      status: call.status,
      outcome: call.outcome,
      started_at: call.started_at,
      ai_handled: call.ai_handled,
      duration_seconds: call.duration_seconds,
    }));
  }
  return getMockDataset().calls.filter((call) => new Date(call.started_at).getTime() >= start.getTime());
}
