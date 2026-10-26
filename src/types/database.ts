/**
 * Database entity types.
 *
 * These map 1:1 to the Supabase/PostgreSQL schema defined in
 * `supabase/migrations`. Keep this file framework-agnostic: no React,
 * no UI concerns. Visual components must never depend on these types
 * directly for fetching -- always go through `src/lib/services`.
 */

export type UUID = string;
export type ISODateString = string;

/** Fields present on every multi-tenant table. */
export interface BaseEntity {
  id: UUID;
  organization_id: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export type UserRole = "ADMIN" | "CLINIC_OWNER" | "OFFICE_MANAGER" | "RECEPTIONIST";

export const USER_ROLES: UserRole[] = ["ADMIN", "CLINIC_OWNER", "OFFICE_MANAGER", "RECEPTIONIST"];

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  CLINIC_OWNER: "Clinic Owner",
  OFFICE_MANAGER: "Office Manager",
  RECEPTIONIST: "Receptionist",
};

/** Coarse-grained feature access used to gate navigation and pages. */
export type Permission =
  | "dashboard.view"
  | "calls.view"
  | "patients.view"
  | "appointments.view"
  | "leads.view"
  | "campaigns.view"
  | "ai_receptionist.view"
  | "knowledge_base.view"
  | "analytics.view"
  | "analytics.limited"
  | "reports.view"
  | "settings.view"
  | "settings.manage_users";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "dashboard.view",
    "calls.view",
    "patients.view",
    "appointments.view",
    "leads.view",
    "campaigns.view",
    "ai_receptionist.view",
    "knowledge_base.view",
    "analytics.view",
    "reports.view",
    "settings.view",
    "settings.manage_users",
  ],
  CLINIC_OWNER: [
    "dashboard.view",
    "calls.view",
    "patients.view",
    "appointments.view",
    "leads.view",
    "campaigns.view",
    "ai_receptionist.view",
    "knowledge_base.view",
    "analytics.view",
    "reports.view",
    "settings.view",
    "settings.manage_users",
  ],
  OFFICE_MANAGER: [
    "dashboard.view",
    "calls.view",
    "patients.view",
    "appointments.view",
    "leads.view",
    "campaigns.view",
    "knowledge_base.view",
    "analytics.view",
    "reports.view",
    "settings.view",
  ],
  RECEPTIONIST: ["dashboard.view", "calls.view", "patients.view", "appointments.view", "analytics.limited"],
};

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  city: string;
  province: string;
  postal_code: string;
  address_line1: string;
  phone: string;
  timezone: string;
  logo_url: string | null;
  plan: "trial" | "starter" | "growth" | "enterprise";
  demo: boolean;
}

export interface AppUser extends BaseEntity {
  auth_user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  title: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export type PatientType = "new" | "existing";
export type PatientStatus = "active" | "needs_follow_up" | "inactive" | "overdue_recall";

export const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  active: "Active",
  needs_follow_up: "Needs follow-up",
  inactive: "Inactive",
  overdue_recall: "Overdue recall",
};

export interface Patient extends BaseEntity {
  full_name: string;
  phone: string;
  email: string | null;
  patient_type: PatientType;
  status: PatientStatus;
  lead_source: LeadSource;
  last_appointment_at: ISODateString | null;
  next_appointment_at: ISODateString | null;
  estimated_value: number;
  is_high_value: boolean;
  notes: string | null;
  ai_summary: string | null;
}

export type LeadSource =
  | "inbound_call"
  | "outbound_call"
  | "website"
  | "chat"
  | "referral"
  | "walk_in"
  | "campaign";

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  inbound_call: "Inbound Call",
  outbound_call: "Outbound Call",
  website: "Website",
  chat: "Web Chat",
  referral: "Referral",
  walk_in: "Walk-in",
  campaign: "Campaign",
};

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "appointment_requested"
  | "booked"
  | "completed"
  | "lost";

export const LEAD_STAGES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "appointment_requested",
  "booked",
  "completed",
  "lost",
];

export const LEAD_STAGE_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  appointment_requested: "Appointment Requested",
  booked: "Booked",
  completed: "Completed",
  lost: "Lost",
};

export type LeadPriority = "low" | "medium" | "high";

export interface Lead extends BaseEntity {
  patient_id: UUID | null;
  patient_name: string;
  phone: string;
  source: LeadSource;
  service: DentalServiceType;
  status: LeadStatus;
  lead_score: number;
  estimated_value: number;
  priority: LeadPriority;
  first_contact_at: ISODateString;
  last_contact_at: ISODateString;
  next_action: string | null;
  appointment_id: UUID | null;
  assigned_to: UUID | null;
  campaign_id: UUID | null;
  // --- Live-mode / AI-qualification fields (Supabase `leads` table) -------
  // Optional because the mock/demo dataset doesn't populate them -- only
  // leads created through the real lead-intake -> n8n -> Supabase pipeline
  // (or AI-qualified leads) have these set. See /docs/SUPABASE_SCHEMA.md.
  email?: string | null;
  first_name?: string;
  last_name?: string | null;
  message?: string | null;
  source_campaign?: string | null;
  /** Raw AI model output -- `lead_score`/`priority` above are derived from these via a controlled business rule, never written directly by the AI. */
  ai_score?: number | null;
  ai_priority?: LeadPriority | null;
  ai_summary?: string | null;
  ai_recommended_action?: string | null;
}

export type DentalServiceType =
  | "general_cleaning"
  | "emergency_dental"
  | "dental_exam"
  | "implants"
  | "invisalign"
  | "whitening"
  | "crowns"
  | "root_canal"
  | "childrens_dentistry"
  | "other";

export const DENTAL_SERVICE_LABELS: Record<DentalServiceType, string> = {
  general_cleaning: "General Cleaning",
  emergency_dental: "Emergency Dental",
  dental_exam: "Dental Exam",
  implants: "Dental Implants",
  invisalign: "Invisalign",
  whitening: "Whitening",
  crowns: "Crowns",
  root_canal: "Root Canal",
  childrens_dentistry: "Children's Dentistry",
  other: "Other",
};

export interface DentalService extends BaseEntity {
  type: DentalServiceType;
  name: string;
  description: string;
  average_value: number;
  is_active: boolean;
}

export type CallDirection = "inbound" | "outbound";
export type CallStatus = "completed" | "missed" | "failed" | "transferred";

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  completed: "Completed",
  missed: "Missed",
  failed: "Failed",
  transferred: "Transferred",
};

export type CallSentiment = "positive" | "neutral" | "negative";

export const CALL_SENTIMENT_LABELS: Record<CallSentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};
export type CallIntent =
  | "new_patient_inquiry"
  | "existing_patient"
  | "appointment_booking"
  | "appointment_reschedule"
  | "emergency"
  | "billing_insurance"
  | "general_question"
  | "other";

export const CALL_INTENT_LABELS: Record<CallIntent, string> = {
  new_patient_inquiry: "New Patient Inquiry",
  existing_patient: "Existing Patient",
  appointment_booking: "Appointment Booking",
  appointment_reschedule: "Reschedule Request",
  emergency: "Emergency",
  billing_insurance: "Billing / Insurance",
  general_question: "General Question",
  other: "Other",
};

export type CallOutcome =
  | "booked"
  | "callback_requested"
  | "information_provided"
  | "transferred_to_staff"
  | "voicemail"
  | "no_action"
  | "lost";

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  booked: "Booked",
  callback_requested: "Callback Requested",
  information_provided: "Information Provided",
  transferred_to_staff: "Transferred to Staff",
  voicemail: "Voicemail",
  no_action: "No Action",
  lost: "Lost",
};

export interface Call extends BaseEntity {
  patient_id: UUID | null;
  patient_name: string | null;
  lead_id: UUID | null;
  direction: CallDirection;
  phone_number: string;
  started_at: ISODateString;
  ended_at: ISODateString | null;
  duration_seconds: number;
  status: CallStatus;
  intent: CallIntent | null;
  outcome: CallOutcome | null;
  ai_summary: string | null;
  ai_handled: boolean;
  ai_confidence: number | null;
  appointment_id: UUID | null;
  recording_url: string | null;
  transcript_id: UUID | null;
  sentiment: CallSentiment | null;
  campaign_id: UUID | null;
  recovered_from_missed: boolean;
}

export interface CallTranscriptLine {
  speaker: "ai" | "patient" | "staff";
  timestamp_seconds: number;
  text: string;
}

export interface CallTranscript extends BaseEntity {
  call_id: UUID;
  lines: CallTranscriptLine[];
  summary: string;
  recommended_follow_up: string | null;
}

export type AppointmentStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export interface Appointment extends BaseEntity {
  patient_id: UUID | null;
  patient_name: string;
  patient_type: PatientType;
  service: DentalServiceType;
  dentist_name: string;
  starts_at: ISODateString;
  ends_at: ISODateString;
  status: AppointmentStatus;
  source: LeadSource;
  lead_id: UUID | null;
  call_id: UUID | null;
  campaign_id: UUID | null;
  estimated_value: number;
  notes: string | null;
}

export type CampaignType =
  | "recall"
  | "missed_call_recovery"
  | "appointment_reminder"
  | "treatment_follow_up"
  | "review_request";

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  recall: "Recall",
  missed_call_recovery: "Missed Call Recovery",
  appointment_reminder: "Appointment Reminder",
  treatment_follow_up: "Treatment Follow-up",
  review_request: "Review Request",
};

export type CampaignStatus = "draft" | "scheduled" | "active" | "completed" | "paused";
export type CampaignChannel = "ai_voice" | "sms" | "email";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  completed: "Completed",
  paused: "Paused",
};

export const CAMPAIGN_CHANNEL_LABELS: Record<CampaignChannel, string> = {
  ai_voice: "AI voice",
  sms: "SMS",
  email: "Email",
};

export interface Campaign extends BaseEntity {
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  channels: CampaignChannel[];
  audience_description: string;
  scheduled_at: ISODateString | null;
  started_at: ISODateString | null;
  completed_at: ISODateString | null;
  contacts_count: number;
  calls_count: number;
  sms_count: number;
  responses_count: number;
  appointments_count: number;
  estimated_revenue: number;
  ai_script: string | null;
}

export type CampaignContactStatus = "pending" | "contacted" | "responded" | "booked" | "opted_out" | "failed";

export interface CampaignContact extends BaseEntity {
  campaign_id: UUID;
  patient_id: UUID | null;
  patient_name: string;
  phone: string;
  status: CampaignContactStatus;
  contacted_at: ISODateString | null;
  responded_at: ISODateString | null;
  appointment_id: UUID | null;
}

export type MessageChannel = "sms" | "email" | "voice";
export type MessageDirection = "inbound" | "outbound";

export interface Message extends BaseEntity {
  conversation_id: UUID;
  patient_id: UUID | null;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  sent_at: ISODateString;
  status: "sent" | "delivered" | "failed" | "read";
}

export interface Conversation extends BaseEntity {
  patient_id: UUID | null;
  patient_name: string;
  channel: MessageChannel;
  last_message_at: ISODateString;
  last_message_preview: string;
}

export type DocumentCategory =
  | "clinic_policies"
  | "services"
  | "insurance"
  | "pricing"
  | "faqs"
  | "emergency_procedures"
  | "patient_instructions";

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  clinic_policies: "Clinic Policies",
  services: "Services",
  insurance: "Insurance",
  pricing: "Pricing",
  faqs: "FAQs",
  emergency_procedures: "Emergency Procedures",
  patient_instructions: "Patient Instructions",
};

export type DocumentStatus = "processing" | "indexed" | "failed";
export type DocumentFileType = "pdf" | "docx" | "txt" | "csv";

export interface KnowledgeDocument extends BaseEntity {
  file_name: string;
  file_type: DocumentFileType;
  category: DocumentCategory;
  status: DocumentStatus;
  chunk_count: number;
  file_size_bytes: number;
  uploaded_by: UUID;
  error_message?: string | null;
}

export interface DocumentChunk extends BaseEntity {
  document_id: UUID;
  content: string;
  chunk_index: number;
  embedding_id: string | null;
}

export type InsightCategory =
  | "revenue"
  | "conversion"
  | "calls"
  | "appointments"
  | "patients"
  | "marketing"
  | "operations";

export const INSIGHT_CATEGORY_LABELS: Record<InsightCategory, string> = {
  revenue: "Revenue",
  conversion: "Conversion",
  calls: "Calls",
  appointments: "Appointments",
  patients: "Patients",
  marketing: "Marketing",
  operations: "Operations",
};

export type InsightSeverity = "opportunity" | "warning" | "information" | "critical";

export interface AIInsight extends BaseEntity {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  recommendation: string;
  metric: string | null;
  metric_value: string | null;
  status: "new" | "acknowledged" | "resolved" | "dismissed";
}

export type NotificationType = "call" | "appointment" | "lead" | "campaign" | "system";

export interface AppNotification extends BaseEntity {
  user_id: UUID | null;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  link: string | null;
}

export type ActivityType =
  | "call_completed"
  | "call_missed"
  | "call_recovered"
  | "appointment_booked"
  | "appointment_reminder_sent"
  | "appointment_cancelled"
  | "lead_created"
  | "review_requested"
  | "campaign_completed"
  | "patient_created";

export interface ActivityLog extends BaseEntity {
  type: ActivityType;
  description: string;
  patient_name: string | null;
  status: "success" | "warning" | "info" | "danger";
  actor: "ai" | "system" | "staff";
}

/**
 * Event backbone written by both the app and n8n (`automation_events` table).
 * See /docs/N8N_WORKFLOWS.md for the full list of event types emitted by each
 * workflow and /docs/SUPABASE_SCHEMA.md for the table definition.
 */
export type AutomationEventStatus = "pending" | "processing" | "completed" | "failed";

export interface AutomationEvent {
  id: UUID;
  organization_id: UUID;
  event_type: string;
  entity_type: string;
  entity_id: UUID | null;
  payload: Record<string, unknown>;
  status: AutomationEventStatus;
  processed_at: ISODateString | null;
  created_at: ISODateString;
}

/** Structured execution/error log written by n8n workflows (`automation_logs` table). */
export interface AutomationLog {
  id: UUID;
  organization_id: UUID | null;
  workflow_name: string;
  execution_id: string | null;
  event_type: string | null;
  status: AutomationEventStatus;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: ISODateString;
}

/**
 * Organization-specific (or global, when `organization_id` is null) AI prompt
 * definition consumed by n8n's "AI -- Lead Qualification" workflow.
 */
export interface PromptTemplate {
  id: UUID;
  organization_id: UUID | null;
  name: string;
  purpose: string | null;
  system_prompt: string;
  user_prompt: string | null;
  model: string;
  temperature: number;
  version: number;
  active: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

/**
 * Structured, validated shape of the AI -- Lead Qualification model output.
 * The n8n workflow MUST validate raw model output against this schema before
 * writing anything to Supabase -- see Phase 11 ("AI Safety / Business Rules")
 * in /docs/N8N_WORKFLOWS.md. `src/lib/ai/lead-qualification-schema.ts` holds
 * the matching Zod schema used by this project's own tests/tooling.
 */
export interface LeadQualificationResult {
  score: number;
  priority: LeadPriority;
  service: string;
  intent: "appointment" | "pricing_question" | "general_question" | "emergency" | "other";
  urgency: "low" | "normal" | "high";
  estimated_value: number;
  recommended_action: string;
  summary: string;
}
