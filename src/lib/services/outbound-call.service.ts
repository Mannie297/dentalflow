/**
 * Places a live outbound call through n8n "ElevenLabs — Outbound Call".
 * Demo Mode does not dial. The phone rings only after ElevenLabs accepts the request.
 */
import { appConfig, isN8nOutboundConfigured } from "@/lib/config";
import { getCurrentDataSource } from "@/lib/runtime-data-source";

export interface PlaceOutboundCallInput {
  patient_name: string;
  phone: string;
  reason: string;
}

export type PlaceOutboundCallResult =
  | { success: true; conversation_id: string | null; message: string }
  | { success: false; error: string };

export async function placeOutboundCall(input: PlaceOutboundCallInput): Promise<PlaceOutboundCallResult> {
  if (getCurrentDataSource() !== "supabase") {
    return { success: false, error: "Switch to Live Mode to place a callback." };
  }
  if (!isN8nOutboundConfigured()) {
    return { success: false, error: "Outbound calling isn't configured." };
  }

  const patient_name = input.patient_name.trim();
  const phone = input.phone.trim();
  const reason = input.reason.trim();
  const digits = phone.replace(/\D/g, "");
  if (!patient_name || digits.length < 7 || !reason) {
    return { success: false, error: "A callback needs the caller's name and phone number." };
  }

  try {
    const response = await fetch(appConfig.n8nOutboundWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_name, phone, reason }),
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON body falls through to the status-based error.
    }

    if (isOutboundSuccess(body)) return body;
    if (isOutboundError(body)) return { success: false, error: body.error };
    if (!response.ok) return { success: false, error: `Couldn't start the callback (HTTP ${response.status}).` };
    return { success: false, error: "Couldn't start the callback." };
  } catch {
    return { success: false, error: "Couldn't reach the outbound calling service. Please try again in a moment." };
  }
}

function isOutboundError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error: unknown }).error === "string";
}

function isOutboundSuccess(value: unknown): value is Extract<PlaceOutboundCallResult, { success: true }> {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { success?: unknown; message?: unknown; conversation_id?: unknown };
  return record.success === true && typeof record.message === "string" && (record.conversation_id == null || typeof record.conversation_id === "string");
}
