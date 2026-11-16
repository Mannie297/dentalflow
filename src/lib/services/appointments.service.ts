import type { Appointment, AppointmentStatus, DentalServiceType, LeadSource, PatientType, UpcomingAppointmentView } from "@/types";
import { matchAppointmentCalls } from "@/lib/appointment-call";
import { isWithinRange } from "@/lib/date-range";
import { formatTime } from "@/lib/format";
import { appConfig, isN8nBookAppointmentConfigured, isN8nCancelAppointmentConfigured } from "@/lib/config";
import { DEMO_ORGANIZATION, getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getOrganization } from "@/lib/services/settings.service";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapAppointmentRow } from "@/lib/supabase/mappers";

export interface AppointmentFilters {
  from?: string;
  to?: string;
  status?: AppointmentStatus;
  service?: DentalServiceType;
  patientType?: PatientType;
  dentistName?: string;
  search?: string;
}

async function getAppointmentsFromSupabase(filters: AppointmentFilters): Promise<Appointment[]> {
  const supabase = getSupabaseBrowserClient();
  let query = supabase.from("appointments").select("*").order("starts_at", { ascending: true });

  if (filters.from && filters.to) {
    query = query.gte("starts_at", filters.from).lte("starts_at", filters.to);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.service) query = query.eq("service", filters.service);
  if (filters.patientType) query = query.eq("patient_type", filters.patientType);
  if (filters.dentistName) query = query.eq("dentist_name", filters.dentistName);
  if (filters.search) query = query.ilike("patient_name", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapAppointmentRow);
}

export async function getAppointments(filters: AppointmentFilters = {}): Promise<Appointment[]> {
  if (getCurrentDataSource() === "supabase") {
    return getAppointmentsFromSupabase(filters);
  }
  const { appointments } = getMockDataset();
  let result = appointments;
  if (filters.from && filters.to) {
    result = result.filter((a) => isWithinRange(a.starts_at, filters.from!, filters.to!));
  }
  if (filters.status) result = result.filter((a) => a.status === filters.status);
  if (filters.service) result = result.filter((a) => a.service === filters.service);
  if (filters.patientType) result = result.filter((a) => a.patient_type === filters.patientType);
  if (filters.dentistName) result = result.filter((a) => a.dentist_name === filters.dentistName);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((a) => a.patient_name.toLowerCase().includes(q));
  }
  return result;
}

export interface AppointmentCaller {
  phone: string | null;
  callId: string | null;
  outboundCalls: { id: string; startedAt: string }[];
}

/** The booking call, and outbound calls placed for this patient after the visit existed. */
export async function getAppointmentCaller(appointment: Appointment): Promise<AppointmentCaller> {
  if (getCurrentDataSource() === "supabase") {
    return getAppointmentCallerFromSupabase(appointment);
  }

  const { calls, patients } = getMockDataset();
  const matched = matchAppointmentCalls(
    {
      id: appointment.id,
      callId: appointment.call_id,
      patientId: appointment.patient_id,
      createdAt: appointment.created_at,
    },
    calls.map((call) => ({
      id: call.id,
      phone: call.phone_number,
      patientId: call.patient_id,
      appointmentId: call.appointment_id,
      startedAt: call.started_at,
      createdAt: call.created_at,
      direction: call.direction,
    }))
  );
  const patient = patients.find((row) => row.id === appointment.patient_id);
  return {
    phone: matched.phone ?? patient?.phone ?? null,
    callId: matched.bookingCallId,
    outboundCalls: matched.outboundCalls,
  };
}

async function getAppointmentCallerFromSupabase(appointment: Appointment): Promise<AppointmentCaller> {
  const supabase = getSupabaseBrowserClient();
  const bookedAt = new Date(appointment.created_at).getTime();
  const graceStart = new Date(bookedAt - 2 * 60 * 1000).toISOString();
  const columns = "id, phone_number, patient_id, appointment_id, started_at, created_at, direction" as const;

  let candidates: { id: string; phone_number: string; patient_id: string | null; appointment_id: string | null; started_at: string; created_at: string; direction: "inbound" | "outbound" }[] = [];

  if (appointment.call_id) {
    const { data, error } = await supabase.from("calls").select(columns).eq("id", appointment.call_id).limit(1);
    if (error) throw error;
    candidates = data ?? [];
  } else {
    const linked = await supabase.from("calls").select(columns).eq("appointment_id", appointment.id).limit(1);
    if (linked.error) throw linked.error;
    candidates = linked.data ?? [];

    if (candidates.length === 0 && appointment.patient_id) {
      const duringCall = await supabase
        .from("calls")
        .select(columns)
        .eq("patient_id", appointment.patient_id)
        .lte("started_at", new Date(bookedAt + 2 * 60 * 1000).toISOString())
        .gte("created_at", graceStart)
        .order("started_at", { ascending: false })
        .limit(8);
      if (duringCall.error) throw duringCall.error;
      candidates = duringCall.data ?? [];
    }
  }

  if (appointment.patient_id) {
    const outbound = await supabase
      .from("calls")
      .select(columns)
      .eq("patient_id", appointment.patient_id)
      .eq("direction", "outbound")
      .gte("started_at", graceStart)
      .order("started_at", { ascending: false })
      .limit(5);
    if (outbound.error) throw outbound.error;
    const seen = new Set(candidates.map((call) => call.id));
    for (const call of outbound.data ?? []) {
      if (!seen.has(call.id)) candidates.push(call);
    }
  }

  const matched = matchAppointmentCalls(
    {
      id: appointment.id,
      callId: appointment.call_id,
      patientId: appointment.patient_id,
      createdAt: appointment.created_at,
    },
    candidates.map((call) => ({
      id: call.id,
      phone: call.phone_number,
      patientId: call.patient_id,
      appointmentId: call.appointment_id,
      startedAt: call.started_at,
      createdAt: call.created_at,
      direction: call.direction,
    }))
  );

  if (matched.phone || matched.bookingCallId || matched.outboundCalls.length > 0) {
    return { phone: matched.phone, callId: matched.bookingCallId, outboundCalls: matched.outboundCalls };
  }

  if (!appointment.patient_id) return { phone: null, callId: null, outboundCalls: [] };
  const { data: patient, error: patientError } = await supabase.from("patients").select("phone").eq("id", appointment.patient_id).maybeSingle();
  if (patientError) throw patientError;
  return { phone: patient?.phone ?? null, callId: null, outboundCalls: [] };
}

export async function getUpcomingAppointments(limit = 6): Promise<UpcomingAppointmentView[]> {
  const now = new Date();

  let upcoming: Appointment[];
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .in("status", ["confirmed", "requested"])
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    upcoming = (data ?? []).map(mapAppointmentRow);
  } else {
    const { appointments } = getMockDataset();
    upcoming = appointments
      .filter((a) => new Date(a.starts_at) >= now && (a.status === "confirmed" || a.status === "requested"))
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, limit);
  }

  return upcoming.map((a) => ({
    id: a.id,
    time: formatTime(a.starts_at),
    patientName: a.patient_name,
    service: a.service,
    patientType: a.patient_type === "new" ? "New Patient" : "Existing",
    status: a.status,
  }));
}

export interface CreateAppointmentInput {
  patient_name: string;
  /**
   * Required when booking via n8n (see `createAppointmentViaN8n` below) --
   * the "ElevenLabs — Book Appointment" workflow uses this to find-or-create
   * the patient record and reject it with a 400 if it's missing fewer than 7
   * digits. Optional for the direct-Supabase-insert path (Demo Mode, or a
   * deployment with no booking webhook configured), since `appointments`
   * doesn't have a phone column of its own.
   */
  phone?: string;
  patient_type: PatientType;
  service: DentalServiceType;
  dentist_name: string;
  starts_at: string;
  ends_at: string;
  estimated_value?: number;
  notes?: string | null;
  source?: LeadSource;
  lead_id?: string | null;
  patient_id?: string | null;
  call_id?: string | null;
}

/**
 * Books a new appointment.
 *
 * When `NEXT_PUBLIC_N8N_BOOK_APPOINTMENT_WEBHOOK_URL` is set, this posts to n8n
 * "ElevenLabs — Book Appointment" instead of writing directly -- that workflow creates
 * the Google Calendar event and the Supabase row together (and rejects a double-booked
 * slot), so every appointment booked through DentalFlow -- from this dialog or from the
 * voice agent's booking tool -- ends up on the same calendar. See /docs/N8N_WORKFLOWS.md.
 *
 * Otherwise, the `organization_id` column is intentionally omitted from the insert --
 * `default_organization_id()` (see 0004_default_organization_id.sql) backfills it from the signed-in
 * user's profile via a before-insert trigger, same as createCampaign() in campaigns.service.ts.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  if (getCurrentDataSource() === "supabase") {
    if (isN8nBookAppointmentConfigured()) {
      return createAppointmentViaN8n(input);
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        patient_name: input.patient_name,
        patient_type: input.patient_type,
        service: input.service,
        dentist_name: input.dentist_name,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        status: "requested",
        estimated_value: input.estimated_value ?? 0,
        notes: input.notes ?? null,
        source: input.source ?? null,
        lead_id: input.lead_id ?? null,
        patient_id: input.patient_id ?? null,
        call_id: input.call_id ?? null,
      } as never)
      .select("*")
      .single();
    if (error) throw error;
    if (input.call_id) {
      const { error: linkError } = await supabase
        .from("calls")
        .update({ appointment_id: data.id } as never)
        .eq("id", input.call_id);
      if (linkError) throw linkError;
    }
    return mapAppointmentRow(data);
  }

  const { appointments, calls } = getMockDataset();
  const now = new Date().toISOString();
  const appointment: Appointment = {
    id: crypto.randomUUID(),
    organization_id: DEMO_ORGANIZATION.id,
    patient_id: input.patient_id ?? null,
    patient_name: input.patient_name,
    patient_type: input.patient_type,
    service: input.service,
    dentist_name: input.dentist_name,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    status: "requested",
    source: input.source ?? "website",
    lead_id: input.lead_id ?? null,
    call_id: input.call_id ?? null,
    campaign_id: null,
    estimated_value: input.estimated_value ?? 0,
    notes: input.notes ?? null,
    calendar_event_id: null,
    created_at: now,
    updated_at: now,
  };
  // Unshift (not push) so the newest appointment surfaces first in any recency-ordered view, matching
  // the Supabase-mode insert's natural "just created" prominence.
  appointments.unshift(appointment);
  if (input.call_id) {
    const index = calls.findIndex((call) => call.id === input.call_id);
    if (index !== -1) {
      calls[index] = { ...calls[index], appointment_id: appointment.id };
    }
  }
  return appointment;
}

/** POSTs to n8n "ElevenLabs — Book Appointment". See createAppointment() above. */
async function createAppointmentViaN8n(input: CreateAppointmentInput): Promise<Appointment> {
  const organization = await getOrganization();
  const response = await fetch(appConfig.n8nBookAppointmentWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: organization.id,
      patient_name: input.patient_name,
      phone: input.phone ?? "",
      patient_type: input.patient_type,
      service: input.service,
      dentist_name: input.dentist_name,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      estimated_value: input.estimated_value ?? 0,
      notes: input.notes ?? null,
      source: input.source ?? null,
      lead_id: input.lead_id ?? null,
      patient_id: input.patient_id ?? null,
      call_id: input.call_id ?? null,
    }),
  });

  const body = await readWebhookJson(response);
  if (isAppointmentWebhookSuccess(body)) return mapAppointmentRow(body.appointment);
  if (isWebhookError(body)) throw new Error(body.error);
  throw new Error(`Couldn't book the appointment (HTTP ${response.status}).`);
}

/**
 * Updates an appointment's status (e.g. confirm, complete, cancel, mark no-show).
 *
 * Cancelling is special-cased: when `NEXT_PUBLIC_N8N_CANCEL_APPOINTMENT_WEBHOOK_URL` is
 * set, this posts to n8n "ElevenLabs — Cancel Appointment" instead, which deletes the
 * matching Google Calendar event (when `calendar_event_id` is set) before marking the
 * appointment cancelled. Every other status change still writes directly -- only
 * cancelling needs to clean up an external calendar event.
 */
export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
  if (getCurrentDataSource() === "supabase") {
    if (status === "cancelled" && isN8nCancelAppointmentConfigured()) {
      return cancelAppointmentViaN8n(id);
    }
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapAppointmentRow(data) : null;
  }
  const { appointments } = getMockDataset();
  const index = appointments.findIndex((a) => a.id === id);
  if (index === -1) return null;
  // Replace (not mutate) the array element -- see the identical note in leads.service.ts's
  // updateLeadStatus for why this matters for React Query's structural-sharing change detection.
  const updated: Appointment = { ...appointments[index], status, updated_at: new Date().toISOString() };
  appointments[index] = updated;
  return updated;
}

/** POSTs to n8n "ElevenLabs — Cancel Appointment". See updateAppointmentStatus() above. */
async function cancelAppointmentViaN8n(appointmentId: string): Promise<Appointment | null> {
  const response = await fetch(appConfig.n8nCancelAppointmentWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointment_id: appointmentId }),
  });

  const body = await readWebhookJson(response);
  if (isAppointmentWebhookSuccess(body)) return mapAppointmentRow(body.appointment);
  if (isWebhookError(body)) throw new Error(body.error);
  throw new Error(`Couldn't cancel the appointment (HTTP ${response.status}).`);
}

async function readWebhookJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isWebhookError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error: unknown }).error === "string";
}

function isAppointmentWebhookSuccess(value: unknown): value is { success: true; appointment: Parameters<typeof mapAppointmentRow>[0] } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { success?: unknown; appointment?: unknown };
  return record.success === true && typeof record.appointment === "object" && record.appointment !== null;
}
