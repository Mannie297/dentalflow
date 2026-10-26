import type { Campaign, CampaignType } from "@/types";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { asJson } from "@/lib/supabase/mappers";
import type { ScheduledDial } from "@/lib/campaigns/schedule-calls";
import {
  RECOVERY_CAMPAIGN_NAME,
  RECOVERY_DELAY_MS,
  RECOVERY_LOOKBACK_MS,
  RECOVERY_REASON,
  selectCallsNeedingRecovery,
} from "@/lib/campaigns/recover-missed-calls";
import { createCampaign, deleteCampaign } from "@/lib/services/campaigns.service";
import { placeOutboundCall } from "@/lib/services/outbound-call.service";

export const SCHEDULED_CALL_EVENT = "campaign.call_scheduled";

export type ScheduledCallStatus = "pending" | "calling" | "contacted" | "failed" | "cancelled";

export interface ScheduledCall {
  id: string;
  campaign_id: string;
  patient_name: string;
  phone: string;
  reason: string;
  status: ScheduledCallStatus;
  scheduled_at: string;
  last_error: string | null;
  missed_call_id: string | null;
}

interface StoredPayload {
  patient_name?: unknown;
  phone?: unknown;
  reason?: unknown;
  scheduled_at?: unknown;
  last_error?: unknown;
  cancelled?: unknown;
  missed_call_id?: unknown;
}

const mockCalls: ScheduledCall[] = [];

export async function scheduleCampaignCalls(input: {
  name: string;
  type: CampaignType;
  reason: string;
  mode: "single" | "batch";
  dials: ScheduledDial[];
}): Promise<Campaign> {
  const firstAt = input.dials.map((dial) => dial.scheduled_at).sort()[0] ?? null;
  const campaign = await createCampaign({
    name: input.name,
    type: input.type,
    audienceDescription: input.mode === "single" ? "One person called at set times" : `${input.dials.length} calls from a spreadsheet`,
    channels: ["ai_voice"],
    scheduledAt: firstAt,
    aiScript: input.reason,
    contactsCount: input.dials.length,
    launch: true,
  });

  if (getCurrentDataSource() !== "supabase") {
    mockCalls.push(
      ...input.dials.map((dial) => ({
        id: `dial-${Math.random().toString(36).slice(2, 9)}`,
        campaign_id: campaign.id,
        patient_name: dial.patient_name,
        phone: dial.phone,
        reason: dial.reason,
        status: "pending" as const,
        scheduled_at: dial.scheduled_at,
        last_error: null,
        missed_call_id: null,
      }))
    );
    return campaign;
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("automation_events").insert(
    input.dials.map((dial) => ({
      organization_id: campaign.organization_id,
      event_type: SCHEDULED_CALL_EVENT,
      entity_type: "campaign",
      entity_id: campaign.id,
      status: "pending" as const,
      payload: asJson({
        patient_name: dial.patient_name,
        phone: dial.phone,
        reason: dial.reason,
        scheduled_at: dial.scheduled_at,
        last_error: null,
        cancelled: false,
      }),
    }))
  );
  if (error) {
    await deleteCampaign(campaign.id);
    throw new Error(error.message);
  }
  return campaign;
}

export async function getScheduledCalls(campaignId: string): Promise<ScheduledCall[]> {
  if (getCurrentDataSource() !== "supabase") {
    return mockCalls.filter((call) => call.campaign_id === campaignId).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("automation_events")
    .select("id, entity_id, status, payload")
    .eq("event_type", SCHEDULED_CALL_EVENT)
    .eq("entity_id", campaignId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapScheduledCall).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

export async function cancelPendingScheduledCalls(campaignId: string): Promise<void> {
  if (getCurrentDataSource() !== "supabase") {
    for (const call of mockCalls) {
      if (call.campaign_id === campaignId && call.status === "pending") call.status = "cancelled";
    }
    return;
  }
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("automation_events")
    .delete()
    .eq("event_type", SCHEDULED_CALL_EVENT)
    .eq("entity_id", campaignId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  const remaining = await getScheduledCalls(campaignId);
  await supabase
    .from("campaigns")
    .update(remaining.length === 0 ? { contacts_count: 0, status: "paused" } : { contacts_count: remaining.length })
    .eq("id", campaignId);
}

export async function dispatchDueCampaignCalls(now = new Date()): Promise<{ placed: number; queued: number }> {
  if (getCurrentDataSource() !== "supabase") return { placed: 0, queued: 0 };
  const supabase = getSupabaseBrowserClient();
  await releaseStuckClaims(now);
  let queued = 0;
  try {
    queued = await enqueueMissedCallRecoveries(now);
  } catch {
    queued = 0;
  }

  const { data, error } = await supabase
    .from("automation_events")
    .select("id, entity_id, status, payload")
    .eq("event_type", SCHEDULED_CALL_EVENT)
    .eq("status", "pending")
    .limit(200);
  if (error) throw new Error(error.message);

  const due = (data ?? [])
    .map(mapScheduledCall)
    .filter((call) => new Date(call.scheduled_at).getTime() <= now.getTime())
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const nextByCampaign = new Map<string, ScheduledCall>();
  for (const call of due) {
    if (!nextByCampaign.has(call.campaign_id)) nextByCampaign.set(call.campaign_id, call);
  }
  if (nextByCampaign.size === 0) return { placed: 0, queued };

  const campaignIds = [...nextByCampaign.keys()];
  const campaignsResult = await supabase.from("campaigns").select("id, status, type, calls_count, started_at").in("id", campaignIds);
  if (campaignsResult.error) throw new Error(campaignsResult.error.message);
  const campaigns = new Map((campaignsResult.data ?? []).map((campaign) => [campaign.id, campaign]));

  let placed = 0;
  for (const call of nextByCampaign.values()) {
    const campaign = campaigns.get(call.campaign_id);
    if (!campaign || (campaign.status !== "scheduled" && campaign.status !== "active")) continue;

    const claim = await supabase
      .from("automation_events")
      .update({ status: "processing", processed_at: now.toISOString() })
      .eq("id", call.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) continue;

    const result = await placeOutboundCall({ patient_name: call.patient_name, phone: call.phone, reason: call.reason });
    const finishedAt = new Date().toISOString();
    await supabase
      .from("automation_events")
      .update({
        status: result.success ? "completed" : "failed",
        processed_at: finishedAt,
        payload: asJson({
          patient_name: call.patient_name,
          phone: call.phone,
          reason: call.reason,
          scheduled_at: call.scheduled_at,
          last_error: result.success ? null : result.error,
          cancelled: false,
          missed_call_id: call.missed_call_id,
        }),
      })
      .eq("id", call.id);

    if (result.success) {
      placed += 1;
      await supabase
        .from("campaigns")
        .update({
          status: "active",
          calls_count: campaign.calls_count + 1,
          started_at: campaign.started_at ?? finishedAt,
        })
        .eq("id", campaign.id);
      if (call.missed_call_id) {
        await supabase.from("calls").update({ recovered_from_missed: true }).eq("id", call.missed_call_id);
      }
    }

    const remaining = await supabase
      .from("automation_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", SCHEDULED_CALL_EVENT)
      .eq("entity_id", campaign.id)
      .eq("status", "pending");
    if (!remaining.error && (remaining.count ?? 0) === 0 && campaign.type !== "missed_call_recovery") {
      await supabase.from("campaigns").update({ status: "completed", completed_at: finishedAt }).eq("id", campaign.id);
    }
  }

  return { placed, queued };
}

async function enqueueMissedCallRecoveries(now: Date): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  const { data: existing, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, organization_id, status, contacts_count")
    .eq("type", "missed_call_recovery")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (campaignError) throw new Error(campaignError.message);
  if (existing?.status === "paused") return 0;
  if (existing) await markRecoveredCalls(existing.id);

  const since = new Date(now.getTime() - RECOVERY_LOOKBACK_MS).toISOString();
  const missedResult = await supabase
    .from("calls")
    .select("id, phone_number, patient_id")
    .eq("direction", "inbound")
    .eq("status", "missed")
    .eq("recovered_from_missed", false)
    .gte("started_at", since)
    .limit(50);
  if (missedResult.error) throw new Error(missedResult.error.message);
  const missedRows = missedResult.data ?? [];
  if (missedRows.length === 0) return 0;

  const patientIds = [...new Set(missedRows.map((row) => row.patient_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (patientIds.length > 0) {
    const patients = await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds);
    if (patients.error) throw new Error(patients.error.message);
    for (const patient of patients.data ?? []) {
      const name = `${patient.first_name} ${patient.last_name ?? ""}`.trim();
      if (name) names.set(patient.id, name);
    }
  }

  let campaignId = existing?.id ?? null;
  let organizationId = existing?.organization_id ?? null;
  let contactsCount = existing?.contacts_count ?? 0;
  const attempted = campaignId ? await recoveryAttemptIds(campaignId) : [];
  const needed = selectCallsNeedingRecovery(
    missedRows.map((row) => ({
      id: row.id,
      phone: row.phone_number ?? "",
      patient_name: (row.patient_id && names.get(row.patient_id)) || "Caller",
    })),
    attempted
  );
  if (needed.length === 0) return 0;

  if (!campaignId || !organizationId) {
    const created = await createCampaign({
      name: RECOVERY_CAMPAIGN_NAME,
      type: "missed_call_recovery",
      audienceDescription: "Inbound callers who were not answered",
      channels: ["ai_voice"],
      scheduledAt: null,
      aiScript: RECOVERY_REASON,
      contactsCount: 0,
      launch: true,
    });
    campaignId = created.id;
    organizationId = created.organization_id;
    contactsCount = 0;
  } else if (existing && existing.status !== "active" && existing.status !== "scheduled") {
    await supabase.from("campaigns").update({ status: "active", completed_at: null }).eq("id", campaignId);
  }

  const scheduledAt = new Date(now.getTime() + RECOVERY_DELAY_MS).toISOString();
  const { error } = await supabase.from("automation_events").insert(
    needed.map((call) => ({
      organization_id: organizationId,
      event_type: SCHEDULED_CALL_EVENT,
      entity_type: "campaign",
      entity_id: campaignId,
      status: "pending" as const,
      payload: asJson({
        patient_name: call.patient_name,
        phone: call.phone,
        reason: RECOVERY_REASON,
        scheduled_at: scheduledAt,
        last_error: null,
        cancelled: false,
        missed_call_id: call.id,
      }),
    }))
  );
  if (error) throw new Error(error.message);
  await supabase
    .from("campaigns")
    .update({ contacts_count: contactsCount + needed.length, status: "active" })
    .eq("id", campaignId);
  return needed.length;
}

async function recoveryAttemptIds(campaignId: string): Promise<string[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("automation_events")
    .select("payload")
    .eq("event_type", SCHEDULED_CALL_EVENT)
    .eq("entity_id", campaignId)
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => (isRecord(row.payload) && typeof row.payload.missed_call_id === "string" ? row.payload.missed_call_id : ""))
    .filter((id) => id.length > 0);
}

async function markRecoveredCalls(campaignId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("automation_events")
    .select("payload")
    .eq("event_type", SCHEDULED_CALL_EVENT)
    .eq("entity_id", campaignId)
    .eq("status", "completed")
    .limit(500);
  if (error) throw new Error(error.message);
  const ids = (data ?? [])
    .map((row) => (isRecord(row.payload) && typeof row.payload.missed_call_id === "string" ? row.payload.missed_call_id : ""))
    .filter((id) => id.length > 0);
  if (ids.length === 0) return;
  await supabase.from("calls").update({ recovered_from_missed: true }).in("id", ids).eq("recovered_from_missed", false);
}

async function releaseStuckClaims(now: Date): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const cutoff = new Date(now.getTime() - 3 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("automation_events")
    .select("id, payload")
    .eq("event_type", SCHEDULED_CALL_EVENT)
    .eq("status", "processing")
    .lt("processed_at", cutoff);
  if (error || !data) return;
  for (const row of data) {
    const payload = isRecord(row.payload) ? row.payload : {};
    await supabase
      .from("automation_events")
      .update({
        status: "failed",
        payload: asJson({ ...payload, last_error: "The call did not finish saving.", cancelled: false }),
      })
      .eq("id", row.id)
      .eq("status", "processing");
  }
}

function mapScheduledCall(row: { id: string; entity_id: string | null; status: string; payload: unknown }): ScheduledCall {
  const payload = (isRecord(row.payload) ? row.payload : {}) as StoredPayload;
  const cancelled = payload.cancelled === true;
  const status: ScheduledCallStatus =
    cancelled ? "cancelled" : row.status === "processing" ? "calling" : row.status === "completed" ? "contacted" : row.status === "failed" ? "failed" : "pending";
  return {
    id: row.id,
    campaign_id: row.entity_id ?? "",
    patient_name: typeof payload.patient_name === "string" ? payload.patient_name : "Unknown",
    phone: typeof payload.phone === "string" ? payload.phone : "",
    reason: typeof payload.reason === "string" ? payload.reason : "",
    status,
    scheduled_at: typeof payload.scheduled_at === "string" ? payload.scheduled_at : "",
    last_error: typeof payload.last_error === "string" ? payload.last_error : null,
    missed_call_id: typeof payload.missed_call_id === "string" ? payload.missed_call_id : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
