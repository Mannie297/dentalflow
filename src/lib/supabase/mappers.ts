/**
 * Maps Supabase row shapes (`Database["public"]["Tables"][...]["Row"]`) onto
 * the existing frontend domain types (`src/types/database.ts`) so every
 * existing UI component keeps working unchanged in Live Mode.
 *
 * Centralizing this mapping here (instead of inline in each service) is what
 * lets `src/types/database.ts` stay the single source of truth for shapes the
 * UI depends on, independent of the exact Postgres column layout.
 */
import type {
  Appointment,
  Call,
  CallTranscript,
  Conversation,
  Lead,
  LeadSource,
  Message,
  Organization,
  Patient,
  AppUser,
} from "@/types";
import type { Database, Json } from "./database.types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type CallRow = Database["public"]["Tables"]["calls"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

const LEAD_SOURCES = new Set<LeadSource>(["inbound_call", "outbound_call", "website", "chat", "referral", "walk_in", "campaign"]);
type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function mapOrganizationRow(row: OrganizationRow): Organization {
  return {
    id: row.id,
    organization_id: row.id,
    name: row.name,
    slug: row.slug,
    city: row.city ?? "",
    province: row.province ?? "",
    postal_code: row.postal_code ?? "",
    address_line1: row.address_line1 ?? "",
    phone: row.phone ?? "",
    timezone: row.timezone,
    logo_url: row.logo_url,
    plan: row.plan,
    demo: row.demo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapProfileRow(row: ProfileRow): AppUser {
  return {
    id: row.id,
    organization_id: row.organization_id,
    auth_user_id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    title: row.title,
    avatar_url: row.avatar_url,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** `leads.patient_name` on the frontend type is derived from first/last name stored in Supabase. */
export function mapLeadRow(row: LeadRow): Lead {
  const patientName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unknown";
  return {
    id: row.id,
    organization_id: row.organization_id,
    patient_id: row.patient_id,
    patient_name: patientName,
    phone: row.phone ?? "",
    source: row.source,
    service: (row.service_requested ?? "other") as Lead["service"],
    status: row.status,
    lead_score: row.ai_score ?? row.lead_score,
    estimated_value: Number(row.estimated_value),
    priority: row.ai_priority ?? row.priority,
    first_contact_at: row.first_contact_at,
    last_contact_at: row.last_contact_at,
    next_action: row.ai_recommended_action ?? row.next_action,
    appointment_id: row.appointment_id,
    assigned_to: row.assigned_to,
    campaign_id: row.campaign_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // Additive fields not on every mock record but present for live/AI-qualified leads --
    // see the optional extensions in src/types/database.ts.
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    message: row.message,
    source_campaign: row.source_campaign,
    ai_score: row.ai_score,
    ai_priority: row.ai_priority,
    ai_summary: row.ai_summary,
    ai_recommended_action: row.ai_recommended_action,
  };
}

export function mapPatientRow(row: PatientRow): Patient {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unknown";
  const leadSource = row.lead_source && LEAD_SOURCES.has(row.lead_source as LeadSource) ? (row.lead_source as LeadSource) : "inbound_call";
  return {
    id: row.id,
    organization_id: row.organization_id,
    full_name: fullName,
    phone: row.phone ?? "",
    email: row.email,
    patient_type: row.patient_type,
    status: row.status,
    lead_source: leadSource,
    last_appointment_at: row.last_appointment_at,
    next_appointment_at: row.next_appointment_at,
    estimated_value: Number(row.estimated_value),
    is_high_value: row.is_high_value,
    notes: row.notes,
    ai_summary: row.ai_summary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function messageChannel(channel: string | null): Message["channel"] {
  if (channel === "sms" || channel === "email" || channel === "voice") return channel;
  return "voice";
}

export function mapConversationRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    organization_id: row.organization_id,
    patient_id: row.patient_id,
    patient_name: row.patient_name ?? "",
    channel: row.channel === "sms" ? "sms" : row.channel === "email" ? "email" : "voice",
    last_message_at: row.last_message_at ?? row.started_at,
    last_message_preview: row.last_message_preview ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapMessageRow(row: MessageRow): Message {
  return {
    id: row.id,
    organization_id: row.organization_id,
    conversation_id: row.conversation_id,
    patient_id: row.patient_id,
    channel: messageChannel(row.channel),
    direction: row.direction,
    body: row.body,
    sent_at: row.sent_at,
    status: row.status ?? "sent",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapCallRow(row: CallRow): Call {
  return {
    id: row.id,
    organization_id: row.organization_id,
    patient_id: row.patient_id,
    patient_name: null,
    lead_id: row.lead_id,
    direction: row.direction,
    phone_number: row.phone_number,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    status: row.status,
    intent: (row.intent as Call["intent"]) ?? null,
    outcome: (row.outcome as Call["outcome"]) ?? null,
    ai_summary: row.ai_summary,
    ai_handled: row.ai_handled,
    ai_confidence: row.ai_confidence,
    appointment_id: row.appointment_id,
    recording_url: row.recording_url,
    transcript_id: row.transcript ? row.id : null,
    sentiment: row.ai_sentiment,
    campaign_id: row.campaign_id,
    recovered_from_missed: row.recovered_from_missed,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapCallRowToTranscript(row: CallRow): CallTranscript | null {
  if (!row.transcript) return null;
  const t = row.transcript as unknown as { lines?: CallTranscript["lines"]; summary?: string; recommended_follow_up?: string | null };
  return {
    id: row.id,
    organization_id: row.organization_id,
    call_id: row.id,
    lines: t.lines ?? [],
    summary: t.summary ?? "",
    recommended_follow_up: t.recommended_follow_up ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapAppointmentRow(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    organization_id: row.organization_id,
    patient_id: row.patient_id,
    patient_name: row.patient_name,
    patient_type: row.patient_type,
    service: row.service as Appointment["service"],
    dentist_name: row.dentist_name,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    source: (row.source as Appointment["source"]) ?? "website",
    lead_id: row.lead_id,
    call_id: row.call_id,
    campaign_id: row.campaign_id,
    estimated_value: Number(row.estimated_value),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function asJson(value: unknown): Json {
  return value as Json;
}
