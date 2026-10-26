import type { Appointment, AppointmentStatus, DentalServiceType, LeadSource, PatientType, UpcomingAppointmentView } from "@/types";
import { isWithinRange } from "@/lib/date-range";
import { formatTime } from "@/lib/format";
import { DEMO_ORGANIZATION, getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
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
 * Books a new appointment. The `organization_id` column is intentionally omitted from the insert --
 * `default_organization_id()` (see 0004_default_organization_id.sql) backfills it from the signed-in
 * user's profile via a before-insert trigger, same as createCampaign() in campaigns.service.ts.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  if (getCurrentDataSource() === "supabase") {
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

/** Updates an appointment's status (e.g. confirm, complete, cancel, mark no-show). */
export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
  if (getCurrentDataSource() === "supabase") {
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
