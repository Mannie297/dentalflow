/**
 * Event contract shared with n8n automations. n8n workflows POST to
 * `/api/events` (see `src/app/api/events/route.ts`) and DentalFlow AI
 * may also emit outbound webhooks to n8n using this same shape.
 */

export const SUPPORTED_EVENT_NAMES = [
  "lead.created",
  "lead.qualified",
  "call.started",
  "call.completed",
  "call.missed",
  "appointment.created",
  "appointment.confirmed",
  "appointment.cancelled",
  "appointment.completed",
  "patient.created",
  "campaign.started",
  "campaign.completed",
  "review.requested",
] as const;

export type SupportedEventName = (typeof SUPPORTED_EVENT_NAMES)[number];

export interface DentalFlowEvent<TPayload = Record<string, unknown>> {
  event_name: SupportedEventName;
  organization_id: string;
  payload: TPayload;
  occurred_at?: string;
  source?: "n8n" | "twilio" | "dentalflow";
}
