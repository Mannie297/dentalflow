import type { Appointment, Call, CampaignContactStatus, Conversation, Lead, Message, Patient, PatientStatus, PatientType } from "@/types";
import { getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapAppointmentRow, mapCallRow, mapConversationRow, mapLeadRow, mapMessageRow, mapPatientRow } from "@/lib/supabase/mappers";

export interface PatientFilters {
  patientType?: PatientType;
  status?: PatientStatus;
  highValueOnly?: boolean;
  search?: string;
}

export interface PatientCampaignHistory {
  id: string;
  name: string;
  status: CampaignContactStatus;
  contacted_at: string | null;
}

export interface PatientProfile {
  patient: Patient;
  calls: Call[];
  appointments: Appointment[];
  leads: Lead[];
  conversations: (Conversation & { messages: Message[] })[];
  campaigns: PatientCampaignHistory[];
}

export async function getPatients(filters: PatientFilters = {}): Promise<Patient[]> {
  if (getCurrentDataSource() === "supabase") {
    return getPatientsFromSupabase(filters);
  }
  const { patients, appointments } = getMockDataset();
  return withAppointmentDates(sortByName(applyPatientFilters(patients, filters)), appointments);
}

export async function getPatient(id: string): Promise<PatientProfile | null> {
  if (getCurrentDataSource() === "supabase") {
    return getPatientFromSupabase(id);
  }
  const { patients, calls, appointments, leads, conversations, messages, campaigns, campaignContacts } = getMockDataset();
  const patient = patients.find((item) => item.id === id);
  if (!patient) return null;

  const patientAppointments = appointments.filter((appointment) => appointment.patient_id === id).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return {
    patient: withAppointmentDates([patient], patientAppointments)[0],
    calls: calls.filter((call) => call.patient_id === id).sort((a, b) => b.started_at.localeCompare(a.started_at)),
    appointments: patientAppointments,
    leads: leads.filter((lead) => lead.patient_id === id),
    conversations: conversations
      .filter((conversation) => conversation.patient_id === id)
      .map((conversation) => ({
        ...conversation,
        messages: messages.filter((message) => message.conversation_id === conversation.id),
      })),
    campaigns: campaignContacts
      .filter((contact) => contact.patient_id === id)
      .map((contact) => ({
        id: contact.id,
        name: campaigns.find((campaign) => campaign.id === contact.campaign_id)?.name ?? "Campaign",
        status: contact.status,
        contacted_at: contact.contacted_at,
      })),
  };
}

async function getPatientsFromSupabase(filters: PatientFilters): Promise<Patient[]> {
  const supabase = getSupabaseBrowserClient();
  let query = supabase.from("patients").select("*").order("last_name", { ascending: true }).order("first_name", { ascending: true });

  if (filters.patientType) query = query.eq("patient_type", filters.patientType);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.highValueOnly) query = query.or("is_high_value.eq.true,estimated_value.gte.2000");
  if (filters.search) {
    const term = `%${filters.search.replace(/[%_,]/g, "")}%`;
    query = query.or(`first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
  }

  const [{ data, error }, appointmentsResult] = await Promise.all([
    query,
    getSupabaseBrowserClient().from("appointments").select("patient_id, starts_at, status"),
  ]);
  if (error) throw error;
  if (appointmentsResult.error) throw appointmentsResult.error;
  return withAppointmentDates((data ?? []).map(mapPatientRow), appointmentsResult.data ?? []);
}

async function getPatientFromSupabase(id: string): Promise<PatientProfile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const patient = mapPatientRow(data);
  const [callsResult, appointmentsResult, leadsResult, conversationsResult] = await Promise.all([
    supabase.from("calls").select("*").eq("patient_id", id).order("started_at", { ascending: false }),
    supabase.from("appointments").select("*").eq("patient_id", id).order("starts_at", { ascending: false }),
    supabase.from("leads").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("conversations").select("*").eq("patient_id", id).order("last_message_at", { ascending: false }),
  ]);
  if (callsResult.error) throw callsResult.error;
  if (appointmentsResult.error) throw appointmentsResult.error;
  if (leadsResult.error) throw leadsResult.error;
  if (conversationsResult.error) throw conversationsResult.error;

  const conversations = (conversationsResult.data ?? []).map(mapConversationRow);
  const conversationIds = conversations.map((conversation) => conversation.id);
  let messages: Message[] = [];
  if (conversationIds.length > 0) {
    const messagesResult = await supabase.from("messages").select("*").in("conversation_id", conversationIds).order("sent_at", { ascending: true });
    if (messagesResult.error) throw messagesResult.error;
    messages = (messagesResult.data ?? []).map(mapMessageRow);
  }

  const appointments = (appointmentsResult.data ?? []).map(mapAppointmentRow);
  const calls = (callsResult.data ?? []).map((row) => ({ ...mapCallRow(row), patient_name: patient.full_name }));
  const leads = (leadsResult.data ?? []).map(mapLeadRow);
  const campaignIds = [...new Set([...calls, ...leads, ...appointments].map((row) => row.campaign_id).filter((id): id is string => Boolean(id)))];
  let campaigns: PatientCampaignHistory[] = [];
  if (campaignIds.length > 0) {
    const campaignsResult = await supabase.from("campaigns").select("id, name").in("id", campaignIds);
    if (campaignsResult.error) throw campaignsResult.error;
    campaigns = (campaignsResult.data ?? []).map((row) => {
      const relatedCall = calls.find((call) => call.campaign_id === row.id);
      const booked = appointments.some((appointment) => appointment.campaign_id === row.id && appointment.status !== "cancelled");
      return {
        id: row.id,
        name: row.name,
        status: booked ? "booked" : relatedCall ? "contacted" : "pending",
        contacted_at: relatedCall?.started_at ?? null,
      };
    });
  }
  return {
    patient: withAppointmentDates([patient], appointments)[0],
    calls,
    appointments,
    leads,
    conversations: conversations.map((conversation) => ({
      ...conversation,
      patient_name: conversation.patient_name || patient.full_name,
      messages: messages.filter((message) => message.conversation_id === conversation.id),
    })),
    campaigns,
  };
}

function applyPatientFilters(patients: Patient[], filters: PatientFilters): Patient[] {
  let result = patients;
  if (filters.patientType) result = result.filter((patient) => patient.patient_type === filters.patientType);
  if (filters.status) result = result.filter((patient) => patient.status === filters.status);
  if (filters.highValueOnly) result = result.filter((patient) => patient.is_high_value || patient.estimated_value >= 2000);
  if (filters.search) {
    const query = filters.search.toLowerCase();
    result = result.filter(
      (patient) =>
        patient.full_name.toLowerCase().includes(query) ||
        patient.phone.toLowerCase().includes(query) ||
        (patient.email ?? "").toLowerCase().includes(query)
    );
  }
  return result;
}

function sortByName(patients: Patient[]): Patient[] {
  return [...patients].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function withAppointmentDates(
  patients: Patient[],
  appointments: { patient_id: string | null; starts_at: string; status: string }[]
): Patient[] {
  const now = Date.now();
  return patients.map((patient) => {
    const times = appointments
      .filter((appointment) => appointment.patient_id === patient.id && appointment.status !== "cancelled")
      .map((appointment) => new Date(appointment.starts_at).getTime())
      .filter((time) => !Number.isNaN(time));
    const past = times.filter((time) => time <= now).sort((a, b) => b - a)[0];
    const upcoming = times.filter((time) => time > now).sort((a, b) => a - b)[0];
    return {
      ...patient,
      last_appointment_at: patient.last_appointment_at ?? (past ? new Date(past).toISOString() : null),
      next_appointment_at: patient.next_appointment_at ?? (upcoming ? new Date(upcoming).toISOString() : null),
    };
  });
}
