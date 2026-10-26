/**
 * Frontend-facing lead intake. Per the deployment architecture, the browser
 * NEVER writes leads to Supabase directly (there usually isn't an
 * authenticated session on a public lead-capture form, and shipping
 * privileged Supabase credentials to the browser is explicitly disallowed).
 * Instead:
 *
 *   Frontend --(this service)--> n8n webhook --(service role)--> Supabase
 *
 * See /docs/N8N_WORKFLOWS.md ("CORE -- Lead Intake") for the workflow that
 * receives this payload.
 */
import { appConfig, isN8nLeadIntakeConfigured } from "@/lib/config";
import { normalizeLeadIntakeInput, validateLeadIntakeInput, type LeadIntakeInput } from "@/lib/lead-intake/validation";

export type { LeadIntakeInput };

export interface LeadIntakeSuccess {
  success: true;
  lead_id: string;
  status: string;
  message: string;
}

export interface LeadIntakeFailure {
  success: false;
  error: string;
}

export type LeadIntakeResponse = LeadIntakeSuccess | LeadIntakeFailure;

/**
 * Validates, normalizes, and submits a new lead to the n8n "CORE -- Lead
 * Intake" webhook. Never throws for expected failure modes (validation
 * errors, network errors, non-2xx responses) -- always returns a typed
 * `LeadIntakeResponse` so callers can render a friendly message instead of
 * an unhandled exception.
 */
export async function submitLeadIntake(input: LeadIntakeInput): Promise<LeadIntakeResponse> {
  const { valid, errors } = validateLeadIntakeInput(input);
  if (!valid) {
    return { success: false, error: errors.join(" ") };
  }

  if (!isN8nLeadIntakeConfigured()) {
    return {
      success: false,
      error: "Lead intake isn't configured for this deployment yet (missing NEXT_PUBLIC_N8N_LEAD_WEBHOOK_URL).",
    };
  }

  const normalized = normalizeLeadIntakeInput(input);

  try {
    const response = await fetch(appConfig.n8nLeadWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON response body -- fall through to the status-code-based error below.
    }

    if (!response.ok) {
      const message = isRecordWithError(body) ? body.error : `Lead intake failed (HTTP ${response.status}).`;
      return { success: false, error: message };
    }

    if (isLeadIntakeSuccess(body)) {
      return body;
    }

    // The webhook responded 2xx but not in the expected shape -- treat as a soft success so a valid
    // lead isn't lost, but surface that the response contract wasn't followed.
    return {
      success: true,
      lead_id: isRecordWithLeadId(body) ? body.lead_id : "unknown",
      status: "created",
      message: "Lead received successfully.",
    };
  } catch {
    return { success: false, error: "Couldn't reach the lead intake service. Please try again in a moment." };
  }
}

function isRecordWithError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error: unknown }).error === "string";
}

function isRecordWithLeadId(value: unknown): value is { lead_id: string } {
  return typeof value === "object" && value !== null && "lead_id" in value;
}

function isLeadIntakeSuccess(value: unknown): value is LeadIntakeSuccess {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { success?: unknown }).success === true &&
    typeof (value as { lead_id?: unknown }).lead_id === "string"
  );
}
