import type {
  AppointmentStatus,
  CallStatus,
  CampaignContactStatus,
  CampaignStatus,
  DocumentStatus,
  InsightSeverity,
  LeadStatus,
  PatientStatus,
} from "@/types";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, StatusTone> = {
  requested: "neutral",
  confirmed: "success",
  completed: "info",
  cancelled: "danger",
  no_show: "warning",
};

export const CALL_STATUS_TONE: Record<CallStatus, StatusTone> = {
  completed: "success",
  missed: "danger",
  failed: "warning",
  transferred: "info",
};

export const PATIENT_STATUS_TONE: Record<PatientStatus, StatusTone> = {
  active: "success",
  needs_follow_up: "warning",
  inactive: "neutral",
  overdue_recall: "danger",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, StatusTone> = {
  new: "neutral",
  contacted: "info",
  qualified: "info",
  appointment_requested: "warning",
  booked: "success",
  completed: "success",
  lost: "danger",
};

export const INSIGHT_SEVERITY_TONE: Record<InsightSeverity, StatusTone> = {
  opportunity: "success",
  warning: "warning",
  information: "info",
  critical: "danger",
};

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, StatusTone> = {
  draft: "neutral",
  scheduled: "info",
  active: "success",
  completed: "info",
  paused: "warning",
};

export const CAMPAIGN_CONTACT_STATUS_TONE: Record<CampaignContactStatus, StatusTone> = {
  pending: "neutral",
  contacted: "info",
  responded: "info",
  booked: "success",
  opted_out: "danger",
  failed: "danger",
};

export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, StatusTone> = {
  processing: "warning",
  indexed: "success",
  failed: "danger",
};
