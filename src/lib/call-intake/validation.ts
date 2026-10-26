/**
 * Validation + normalization for inbound and outbound call intake.
 *
 * The in-app "Log call" action and the n8n "CORE -- Call Intake" workflow
 * (`/n8n/workflows/core-call-intake.json`) both follow these rules. Keep them
 * in sync if either side changes.
 */
import type { CallDirection, CallIntent, CallOutcome, CallStatus } from "@/types";

export const VALID_CALL_DIRECTIONS: CallDirection[] = ["inbound", "outbound"];
export const VALID_CALL_STATUSES: CallStatus[] = ["completed", "missed", "failed", "transferred"];
export const VALID_CALL_INTENTS: CallIntent[] = [
  "new_patient_inquiry",
  "existing_patient",
  "appointment_booking",
  "appointment_reschedule",
  "emergency",
  "billing_insurance",
  "general_question",
  "other",
];
export const VALID_CALL_OUTCOMES: CallOutcome[] = [
  "booked",
  "callback_requested",
  "information_provided",
  "transferred_to_staff",
  "voicemail",
  "no_action",
  "lost",
];

export interface CallIntakeInput {
  organization_id?: string | null;
  direction: string;
  caller_name: string;
  phone: string;
  status?: string | null;
  intent?: string | null;
  outcome?: string | null;
  duration_seconds?: number | null;
  started_at?: string | null;
  notes?: string | null;
}

export interface NormalizedCallIntake {
  organization_id: string | null;
  direction: CallDirection;
  caller_name: string;
  phone: string;
  status: CallStatus;
  intent: CallIntent | null;
  outcome: CallOutcome | null;
  duration_seconds: number;
  started_at: string;
  notes: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCallIntakeInput(input: Partial<CallIntakeInput>, options?: { requireOrganization?: boolean }): ValidationResult {
  const errors: string[] = [];

  if (options?.requireOrganization && (!input.organization_id || !input.organization_id.trim())) {
    errors.push("organization_id is required.");
  }
  if (!input.direction || !VALID_CALL_DIRECTIONS.includes(input.direction as CallDirection)) {
    errors.push(`direction must be one of: ${VALID_CALL_DIRECTIONS.join(", ")}.`);
  }
  if (!input.caller_name || !input.caller_name.trim()) {
    errors.push("caller_name is required.");
  }
  if (!input.phone || !input.phone.trim()) {
    errors.push("phone is required.");
  } else if (input.phone.replace(/[^0-9]/g, "").length < 7) {
    errors.push("phone must include at least 7 digits.");
  }
  if (input.status && !VALID_CALL_STATUSES.includes(input.status as CallStatus)) {
    errors.push(`status must be one of: ${VALID_CALL_STATUSES.join(", ")}.`);
  }
  if (input.intent && !VALID_CALL_INTENTS.includes(input.intent as CallIntent)) {
    errors.push(`intent must be one of: ${VALID_CALL_INTENTS.join(", ")}.`);
  }
  if (input.outcome && !VALID_CALL_OUTCOMES.includes(input.outcome as CallOutcome)) {
    errors.push(`outcome must be one of: ${VALID_CALL_OUTCOMES.join(", ")}.`);
  }
  if (input.duration_seconds != null && (!Number.isFinite(input.duration_seconds) || input.duration_seconds < 0)) {
    errors.push("duration_seconds must be zero or greater.");
  }
  if (input.started_at && Number.isNaN(new Date(input.started_at).getTime())) {
    errors.push("started_at must be a valid date.");
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeCallIntakeInput(input: CallIntakeInput): NormalizedCallIntake {
  const status = (input.status as CallStatus) || "completed";
  const noDuration = status === "missed" || status === "failed";
  const duration = noDuration ? 0 : Math.round(input.duration_seconds ?? 0);
  const startedAt = input.started_at ? new Date(input.started_at).toISOString() : new Date().toISOString();

  return {
    organization_id: input.organization_id?.trim() || null,
    direction: input.direction as CallDirection,
    caller_name: capitalizeWords(input.caller_name.trim()),
    phone: normalizePhone(input.phone),
    status,
    intent: (input.intent as CallIntent) || null,
    outcome: noDuration ? null : (input.outcome as CallOutcome) || null,
    duration_seconds: duration,
    started_at: startedAt,
    notes: input.notes?.trim() || null,
  };
}

/** Terminal automation event for a logged call. A missed or failed call is `call.missed`; everything else is `call.completed`. */
export function callEventType(status: CallStatus): "call.missed" | "call.completed" {
  return status === "missed" || status === "failed" ? "call.missed" : "call.completed";
}

export function splitCallerName(callerName: string): { first_name: string; last_name: string } {
  const parts = callerName.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] ?? "Unknown", last_name: parts.slice(1).join(" ") };
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function capitalizeWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
