import type { Call, CallDirection, CallStatus, CallTranscript } from "@/types";
import { callEventType, splitCallerName, type NormalizedCallIntake } from "@/lib/call-intake/validation";
import { isWithinRange } from "@/lib/date-range";
import { DEMO_ORGANIZATION, getMockDataset } from "@/lib/mock";
import { SeededRandom } from "@/lib/mock/seed";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { asJson, mapCallRow, mapCallRowToTranscript } from "@/lib/supabase/mappers";

export interface CallFilters {
  from?: string;
  to?: string;
  direction?: CallDirection;
  status?: CallStatus;
  aiHandled?: boolean;
  search?: string;
  limit?: number;
}

async function getCallsFromSupabase(filters: CallFilters): Promise<Call[]> {
  const supabase = getSupabaseBrowserClient();
  let query = supabase.from("calls").select("*").order("started_at", { ascending: false });

  if (filters.from && filters.to) {
    query = query.gte("started_at", filters.from).lte("started_at", filters.to);
  }
  if (filters.direction) query = query.eq("direction", filters.direction);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.aiHandled !== undefined) query = query.eq("ai_handled", filters.aiHandled);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  // Name search happens after patient names are attached. The calls table has no caller-name column;
  // the name lives on the linked patient.
  let calls = await attachPatientNames((data ?? []).map(mapCallRow));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    calls = calls.filter((c) => c.phone_number.toLowerCase().includes(q) || (c.patient_name?.toLowerCase().includes(q) ?? false));
  }
  return calls;
}

export async function getCalls(filters: CallFilters = {}): Promise<Call[]> {
  if (getCurrentDataSource() === "supabase") {
    return getCallsFromSupabase(filters);
  }
  const { calls } = getMockDataset();
  let result = calls;

  if (filters.from && filters.to) {
    result = result.filter((c) => isWithinRange(c.started_at, filters.from!, filters.to!));
  }
  if (filters.direction) {
    result = result.filter((c) => c.direction === filters.direction);
  }
  if (filters.status) {
    result = result.filter((c) => c.status === filters.status);
  }
  if (filters.aiHandled !== undefined) {
    result = result.filter((c) => c.ai_handled === filters.aiHandled);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (c) => c.patient_name?.toLowerCase().includes(q) || c.phone_number.includes(q)
    );
  }
  return filters.limit ? result.slice(0, filters.limit) : result;
}

export async function getCall(id: string): Promise<Call | null> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("calls").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [call] = await attachPatientNames([mapCallRow(data)]);
    return call ?? null;
  }
  const { calls } = getMockDataset();
  return calls.find((c) => c.id === id) ?? null;
}

export async function getRecentCalls(limit = 8): Promise<Call[]> {
  return getCalls({ limit });
}

/**
 * Records a finished inbound or outbound call.
 *
 * Live Mode writes through the signed-in user's Supabase session (RLS + the
 * `default_organization_id` trigger), finds or creates the patient by phone,
 * and logs `call.completed` or `call.missed`. The n8n "CORE -- Call Intake"
 * workflow performs the same writes when a phone system posts the webhook
 * instead of a staff member using the Calls page.
 */
export async function logCall(input: NormalizedCallIntake): Promise<Call> {
  const endedAt =
    input.duration_seconds > 0 ? new Date(new Date(input.started_at).getTime() + input.duration_seconds * 1000).toISOString() : null;
  const transcript = staffTranscript(input);

  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const patientId = await findOrCreatePatient(input);
    const { data, error } = await supabase
      .from("calls")
      .insert({
        patient_id: patientId,
        direction: input.direction,
        status: input.status,
        phone_number: input.phone,
        started_at: input.started_at,
        ended_at: endedAt,
        duration_seconds: input.duration_seconds,
        intent: input.intent,
        outcome: input.outcome,
        ai_handled: false,
        ai_summary: input.notes,
        transcript,
      } as never)
      .select("*")
      .single();
    if (error) throw error;

    const eventType = callEventType(input.status);
    await supabase.from("automation_events").insert({
      organization_id: data.organization_id,
      event_type: eventType,
      entity_type: "call",
      entity_id: data.id,
      payload: asJson({
        patient_name: input.caller_name,
        direction: input.direction,
        phone_number: input.phone,
        status: input.status,
      }),
      status: "completed",
      processed_at: new Date().toISOString(),
    });

    return { ...mapCallRow(data), patient_name: input.caller_name };
  }

  const { calls } = getMockDataset();
  const now = new Date().toISOString();
  const call: Call = {
    id: crypto.randomUUID(),
    organization_id: DEMO_ORGANIZATION.id,
    patient_id: null,
    patient_name: input.caller_name,
    lead_id: null,
    direction: input.direction,
    phone_number: input.phone,
    started_at: input.started_at,
    ended_at: endedAt,
    duration_seconds: input.duration_seconds,
    status: input.status,
    intent: input.intent,
    outcome: input.outcome,
    ai_summary: input.notes,
    ai_handled: false,
    ai_confidence: null,
    appointment_id: null,
    recording_url: null,
    transcript_id: transcript ? crypto.randomUUID() : null,
    sentiment: null,
    campaign_id: null,
    recovered_from_missed: false,
    created_at: now,
    updated_at: now,
  };
  calls.unshift(call);
  return call;
}

async function findOrCreatePatient(input: NormalizedCallIntake): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data: existing, error: lookupError } = await supabase
    .from("patients")
    .select("id")
    .eq("phone", input.phone)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing.id;

  const name = splitCallerName(input.caller_name);
  const { data, error } = await supabase
    .from("patients")
    .insert({
      first_name: name.first_name,
      last_name: name.last_name,
      phone: input.phone,
      patient_type: "new",
      lead_source: input.direction === "inbound" ? "inbound_call" : "outbound_call",
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function staffTranscript(input: NormalizedCallIntake): {
  lines: { speaker: "staff"; timestamp_seconds: number; text: string }[];
  summary: string;
  recommended_follow_up: string | null;
} | null {
  if (input.status === "missed" || input.status === "failed") return null;
  const label = input.direction === "inbound" ? "Inbound" : "Outbound";
  return {
    lines: [
      {
        speaker: "staff",
        timestamp_seconds: 0,
        text: input.notes || `${label} call with ${input.caller_name}.`,
      },
    ],
    summary: input.notes || `${label} call logged by staff.`,
    recommended_follow_up: input.outcome === "callback_requested" ? "Front desk should call back within 2 business hours." : null,
  };
}

/** The calls table stores `patient_id` only. Names are filled from `patients` so the Calls list can show who called. */
async function attachPatientNames(calls: Call[]): Promise<Call[]> {
  const ids = [...new Set(calls.map((c) => c.patient_id).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return calls;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("patients").select("id, first_name, last_name").in("id", ids);
  if (error) throw error;
  const names = new Map((data ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));
  return calls.map((call) =>
    call.patient_id && names.has(call.patient_id) ? { ...call, patient_name: names.get(call.patient_id) || call.patient_name } : call
  );
}

/**
 * Returns the structured transcript for a call.
 *  - Live Mode: reads the `transcript` jsonb column written by the AI
 *    receptionist / call-recording pipeline (null if not yet available).
 *  - Demo Mode: deterministically generates a readable transcript so call
 *    detail pages always have content.
 */
export async function getCallTranscript(callId: string): Promise<CallTranscript | null> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("calls").select("*").eq("id", callId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const stored = mapCallRowToTranscript(data);
    if (stored) return stored;
    if (!data.ai_summary) return null;
    const call = mapCallRow(data);
    return {
      id: data.id,
      organization_id: data.organization_id,
      call_id: data.id,
      lines: [],
      summary: data.ai_summary,
      recommended_follow_up: recommendedFollowUp(call),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
  const call = await getCall(callId);
  if (!call || call.status === "missed") return null;

  const rng = new SeededRandom(hashStringToSeed(callId));
  const patientName = call.patient_name?.split(" ")[0] ?? "the patient";
  const lines: CallTranscript["lines"] = [
    { speaker: "ai", timestamp_seconds: 0, text: `Thank you for calling Maple Grove Dental Clinic, this is the virtual assistant. How can I help you today?` },
    { speaker: "patient", timestamp_seconds: 6, text: intentOpeningLine(call.intent, patientName) },
    { speaker: "ai", timestamp_seconds: 14, text: "I'd be happy to help with that. Can I get your full name and the best phone number to reach you?" },
    { speaker: "patient", timestamp_seconds: 22, text: `Sure, it's ${call.patient_name ?? "not on file"}, and you can reach me at ${call.phone_number}.` },
    { speaker: "ai", timestamp_seconds: 30, text: outcomeLine(call.outcome) },
    { speaker: "patient", timestamp_seconds: 40, text: rng.pick(["That sounds great, thank you!", "Perfect, that works for me.", "Yes, please go ahead and book that.", "I appreciate the help."]) },
    { speaker: "ai", timestamp_seconds: 48, text: "Wonderful — is there anything else I can help you with today?" },
    { speaker: "patient", timestamp_seconds: 54, text: "No, that's everything. Thank you!" },
    { speaker: "ai", timestamp_seconds: 58, text: "Thank you for calling Maple Grove Dental Clinic. Have a great day!" },
  ];

  return {
    id: call.transcript_id ?? `transcript-${callId}`,
    organization_id: call.organization_id,
    call_id: call.id,
    lines,
    summary: summaryForCall(call),
    recommended_follow_up: recommendedFollowUp(call),
    created_at: call.started_at,
    updated_at: call.started_at,
  };
}

function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function intentOpeningLine(intent: Call["intent"], name: string): string {
  switch (intent) {
    case "new_patient_inquiry":
      return "Hi, I'm not a patient yet, but I'd like to learn more about becoming one and booking an appointment.";
    case "appointment_booking":
      return "Hi, I'd like to book an appointment please.";
    case "appointment_reschedule":
      return "Hi, I need to reschedule my upcoming appointment.";
    case "emergency":
      return "Hi, I'm in a lot of pain and I think I need to be seen today.";
    case "existing_patient":
      return `Hi, this is ${name}, I'm an existing patient calling with a quick question.`;
    case "billing_insurance":
      return "Hi, I had a question about my insurance coverage for a recent visit.";
    default:
      return "Hi, I had a general question about your clinic.";
  }
}

function outcomeLine(outcome: Call["outcome"]): string {
  switch (outcome) {
    case "booked":
      return "I have an opening this week that should work well — let's get that booked in for you right now.";
    case "callback_requested":
      return "Let me pass this along to our team and have someone call you back shortly.";
    case "information_provided":
      return "Happy to answer that for you — here's what I can share based on our clinic policies.";
    case "transferred_to_staff":
      return "Let me connect you with a member of our dental team who can help with that.";
    case "voicemail":
      return "It looks like we weren't able to connect — please leave your details and we'll follow up shortly.";
    default:
      return "Let me see what I can do to help with that.";
  }
}

function summaryForCall(call: Call): string {
  const service = call.intent === "emergency" ? "an urgent dental issue" : "a routine inquiry";
  const outcomeText = call.outcome === "booked" ? "An appointment was booked during the call." : "No appointment was booked during this call.";
  return `Caller reached out regarding ${service}. ${outcomeText}`;
}

function recommendedFollowUp(call: Call): string | null {
  if (call.outcome === "booked") return "Send appointment confirmation and add to reminder sequence.";
  if (call.outcome === "callback_requested") return "Front desk should call back within 2 business hours.";
  if (call.outcome === "voicemail") return "Send automated SMS follow-up within 15 minutes.";
  return null;
}
