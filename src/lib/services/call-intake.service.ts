/**
 * Records an inbound or outbound call.
 *
 * Staff using the Calls page write through `logCall()` (Supabase in Live Mode,
 * the in-memory dataset in Demo Mode). When `NEXT_PUBLIC_N8N_CALL_WEBHOOK_URL`
 * is set, Live Mode posts the same payload to n8n "CORE -- Call Intake"
 * instead, so a phone system and the app share one write path.
 */
import { appConfig, isN8nCallIntakeConfigured } from "@/lib/config";
import { normalizeCallIntakeInput, validateCallIntakeInput, type CallIntakeInput } from "@/lib/call-intake/validation";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { logCall } from "./calls.service";

export interface RecordCallSuccess {
  success: true;
  call_id: string;
  message: string;
}

export interface RecordCallFailure {
  success: false;
  error: string;
}

export type RecordCallResult = RecordCallSuccess | RecordCallFailure;

export async function recordCall(input: CallIntakeInput): Promise<RecordCallResult> {
  const useWebhook = getCurrentDataSource() === "supabase" && isN8nCallIntakeConfigured();
  const { valid, errors } = validateCallIntakeInput(input, { requireOrganization: useWebhook });
  if (!valid) return { success: false, error: errors.join(" ") };

  const normalized = normalizeCallIntakeInput(input);

  if (useWebhook) {
    return postCallWebhook(normalized);
  }

  try {
    const call = await logCall(normalized);
    return { success: true, call_id: call.id, message: "Call logged." };
  } catch {
    return { success: false, error: "Couldn't save the call. Please try again." };
  }
}

async function postCallWebhook(input: ReturnType<typeof normalizeCallIntakeInput>): Promise<RecordCallResult> {
  try {
    const response = await fetch(appConfig.n8nCallWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON body falls through to the status-based error.
    }

    if (!response.ok) {
      const message = isRecordWithError(body) ? body.error : `Call intake failed (HTTP ${response.status}).`;
      return { success: false, error: message };
    }

    if (isRecordCallSuccess(body)) return body;
    return {
      success: true,
      call_id: isRecordWithCallId(body) ? body.call_id : "unknown",
      message: "Call received.",
    };
  } catch {
    return { success: false, error: "Couldn't reach the call intake service. Please try again in a moment." };
  }
}

function isRecordWithError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error: unknown }).error === "string";
}

function isRecordWithCallId(value: unknown): value is { call_id: string } {
  return typeof value === "object" && value !== null && "call_id" in value && typeof (value as { call_id: unknown }).call_id === "string";
}

function isRecordCallSuccess(value: unknown): value is RecordCallSuccess {
  return isRecordWithCallId(value) && (value as { success?: unknown }).success === true && typeof (value as { message?: unknown }).message === "string";
}
