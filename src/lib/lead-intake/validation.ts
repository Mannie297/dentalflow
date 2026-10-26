/**
 * Pure validation + normalization for inbound lead-intake submissions. Kept
 * free of any network/Supabase/React dependency so it's trivially unit
 * testable (see `src/lib/lead-intake/__tests__/validation.test.ts`) and so
 * the exact same logic can be ported into the n8n "CORE -- Lead Intake"
 * workflow's "Validate Request" / "Normalize Lead" nodes (see
 * /docs/N8N_WORKFLOWS.md) -- the frontend and the workflow must agree on
 * what counts as a valid lead.
 */
import type { LeadSource } from "@/types";

export const VALID_LEAD_SOURCES: LeadSource[] = [
  "inbound_call",
  "outbound_call",
  "website",
  "chat",
  "referral",
  "walk_in",
  "campaign",
];

export interface LeadIntakeInput {
  organization_id: string;
  source: string;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  service_requested?: string | null;
  message?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a raw lead-intake payload.
 *
 * Rules (see Phase 9 "VALIDATION" in the deployment spec):
 *  - organization_id is required.
 *  - first_name is required (trimmed, non-empty).
 *  - source must be one of the known lead sources.
 *  - at least one of phone/email must be present -- a lead is never rejected
 *    just because email is missing if a phone number was provided (or vice versa).
 */
export function validateLeadIntakeInput(input: Partial<LeadIntakeInput>): ValidationResult {
  const errors: string[] = [];

  if (!input.organization_id || !input.organization_id.trim()) {
    errors.push("organization_id is required.");
  }
  if (!input.first_name || !input.first_name.trim()) {
    errors.push("first_name is required.");
  }
  if (!input.source || !VALID_LEAD_SOURCES.includes(input.source as LeadSource)) {
    errors.push(`source must be one of: ${VALID_LEAD_SOURCES.join(", ")}.`);
  }
  const hasPhone = Boolean(input.phone && input.phone.trim());
  const hasEmail = Boolean(input.email && input.email.trim());
  if (!hasPhone && !hasEmail) {
    errors.push("At least one of phone or email is required.");
  }
  if (hasEmail && !isPlausibleEmail(input.email!)) {
    errors.push("email does not look like a valid email address.");
  }

  return { valid: errors.length === 0, errors };
}

function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Normalizes a lead-intake payload: trims whitespace, lowercases email,
 * strips non-dialing characters from phone numbers (keeping a leading `+`),
 * and preserves the user's original free-text message verbatim.
 *
 * Call this AFTER `validateLeadIntakeInput` confirms the input is valid --
 * it assumes `organization_id`/`first_name`/`source` are present.
 */
export function normalizeLeadIntakeInput(input: LeadIntakeInput): LeadIntakeInput {
  return {
    organization_id: input.organization_id.trim(),
    source: input.source.trim().toLowerCase(),
    first_name: capitalizeWords(input.first_name.trim()),
    last_name: input.last_name ? capitalizeWords(input.last_name.trim()) : null,
    phone: input.phone ? normalizePhone(input.phone) : null,
    email: input.email ? input.email.trim().toLowerCase() : null,
    service_requested: input.service_requested ? input.service_requested.trim() : null,
    // Preserve the original message verbatim (only trimmed) -- never rewrite a patient's own words.
    message: input.message ? input.message.trim() : null,
  };
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
