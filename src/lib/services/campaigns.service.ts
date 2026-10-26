import type { Appointment, Call, Campaign, CampaignChannel, CampaignContact, CampaignPerformanceView, CampaignStatus, CampaignType, Lead, Patient } from "@/types";
import { CAMPAIGN_TYPE_LABELS } from "@/types";
import { getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { matchCampaignCalls, patientNameForCall, type PlacedCampaignDial } from "@/lib/campaigns/link-campaign-calls";
import { mapAppointmentRow, mapCallRow, mapLeadRow, mapPatientRow } from "@/lib/supabase/mappers";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];

export const AUDIENCE_PRESETS = [
  { id: "inactive_6_months", label: "Patients inactive for more than 6 months" },
  { id: "missed_appointments", label: "Patients who missed an appointment" },
  { id: "implant_leads", label: "Implant leads without an appointment" },
  { id: "invisalign_leads", label: "Invisalign leads without an appointment" },
] as const;

export type AudiencePreset = (typeof AUDIENCE_PRESETS)[number]["id"];

export interface AudiencePreview {
  label: string;
  contacts: { id: string; name: string; phone: string }[];
}

export interface CampaignDetail {
  campaign: Campaign;
  contacts: CampaignContact[];
  calls: Call[];
  appointments: Appointment[];
}

export interface CreateCampaignInput {
  name: string;
  type: CampaignType;
  audienceDescription: string;
  channels: CampaignChannel[];
  scheduledAt: string | null;
  aiScript: string;
  contactsCount: number;
  launch: boolean;
}

export async function getCampaigns(): Promise<Campaign[]> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const [campaignsResult, callsResult, appointmentsResult] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("calls").select("campaign_id, status"),
      supabase.from("appointments").select("campaign_id, status, estimated_value"),
    ]);
    if (campaignsResult.error) throw campaignsResult.error;
    if (callsResult.error) throw callsResult.error;
    if (appointmentsResult.error) throw appointmentsResult.error;
    return (campaignsResult.data ?? []).map((row) =>
      withLiveCounts(mapCampaignRow(row), callsResult.data ?? [], appointmentsResult.data ?? [])
    );
  }
  return getMockDataset().campaigns;
}

function placedDials(rows: { payload: unknown; processed_at: string | null }[]): PlacedCampaignDial[] {
  return rows.flatMap((row) => {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? (row.payload as Record<string, unknown>) : null;
    const phone = typeof payload?.phone === "string" ? payload.phone : "";
    const scheduledAt = typeof payload?.scheduled_at === "string" ? payload.scheduled_at : row.processed_at ?? "";
    const patientName = typeof payload?.patient_name === "string" ? payload.patient_name : null;
    return phone && scheduledAt ? [{ phone, scheduledAt, patientName }] : [];
  });
}

/** The outbound call is filed without a campaign id. Match it back to the completed dial so the campaign Calls list can show it. */
async function attachPlacedCampaignCalls(campaignId: string, alreadyLinked: Call[]): Promise<Call[]> {
  const supabase = getSupabaseBrowserClient();
  const events = await supabase
    .from("automation_events")
    .select("payload, processed_at")
    .eq("event_type", "campaign.call_scheduled")
    .eq("entity_id", campaignId)
    .eq("status", "completed");
  const dials = events.error ? [] : placedDials(events.data ?? []);
  if (dials.length === 0) return alreadyLinked;

  const times = dials.map((dial) => new Date(dial.scheduledAt).getTime()).filter((time) => !Number.isNaN(time));
  const from = new Date(Math.min(...times) - 45 * 60_000).toISOString();
  const to = new Date(Math.max(...times) + 45 * 60_000).toISOString();
  const candidates = await supabase
    .from("calls")
    .select("*")
    .eq("direction", "outbound")
    .is("campaign_id", null)
    .gte("started_at", from)
    .lte("started_at", to);
  const ids = candidates.error ? [] : matchCampaignCalls(dials, candidates.data ?? []);
  if (ids.length > 0) {
    await supabase.from("calls").update({ campaign_id: campaignId }).in("id", ids).is("campaign_id", null);
  }

  const refreshed = await supabase.from("calls").select("*").eq("campaign_id", campaignId).order("started_at", { ascending: false });
  if (refreshed.error) return alreadyLinked;
  return (refreshed.data ?? []).map((row) => ({
    ...mapCallRow(row),
    patient_name: patientNameForCall(dials, row.phone_number),
  }));
}

export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [callsResult, appointmentsResult, preview] = await Promise.all([
      supabase.from("calls").select("*").eq("campaign_id", id).order("started_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("campaign_id", id).order("starts_at", { ascending: false }),
      audienceForDescription(data.audience_description ?? ""),
    ]);
    if (callsResult.error) throw callsResult.error;
    if (appointmentsResult.error) throw appointmentsResult.error;
    const calls = await attachPlacedCampaignCalls(id, (callsResult.data ?? []).map(mapCallRow));
    const appointments = (appointmentsResult.data ?? []).map(mapAppointmentRow);
    const campaign = withLiveCounts(mapCampaignRow(data), calls, appointments);
    return { campaign, contacts: previewToContacts(campaign, preview), calls, appointments };
  }

  const { campaigns, campaignContacts, calls, appointments } = getMockDataset();
  const campaign = campaigns.find((item) => item.id === id);
  if (!campaign) return null;
  return {
    campaign,
    contacts: campaignContacts.filter((contact) => contact.campaign_id === id),
    calls: calls.filter((call) => call.campaign_id === id),
    appointments: appointments.filter((appointment) => appointment.campaign_id === id),
  };
}

export async function previewAudience(preset: AudiencePreset): Promise<AudiencePreview> {
  const label = AUDIENCE_PRESETS.find((item) => item.id === preset)?.label ?? "Audience";
  const { patients, leads, appointments } = await loadAudienceSource();
  return { label, contacts: matchAudience(preset, patients, leads, appointments) };
}

export function buildCampaignScript(type: CampaignType, channels: CampaignChannel[]): string {
  const scripts: Record<CampaignType, string> = {
    recall:
      "Hello, this is Maple Grove Dental Clinic. It has been a while since your last visit, and we would like to help you book a hygiene appointment. If now is not a good time, the front desk can call you back. This call is not medical advice.",
    missed_call_recovery:
      "Hello, this is Maple Grove Dental Clinic. We missed your call and wanted to help you reach the clinic. If you would like to book a visit, I can take a preferred day and time for the front desk. If this is a dental emergency, tell me and I will follow the clinic's emergency policy.",
    appointment_reminder:
      "Hello, this is Maple Grove Dental Clinic calling with a reminder about your upcoming visit. Please call the clinic if you need to change the time. This message does not include treatment or pricing.",
    treatment_follow_up:
      "Hello, this is Maple Grove Dental Clinic. We are following up so you can book the next step your dentist already discussed with you. I cannot diagnose, prescribe, or quote a price on this call. If you have pain or swelling, tell me and I will follow the clinic's emergency policy.",
    review_request:
      "Hello, this is Maple Grove Dental Clinic. Thank you for visiting us. If you have a moment, we would appreciate a short review of your experience. This message does not ask for medical details.",
  };
  const extra = channels.some((channel) => channel === "sms" || channel === "email")
    ? " The same wording can be used for a text or email. Do not add prices, insurance coverage, or treatment advice."
    : "";
  return `${scripts[type]}${extra}`;
}

export async function getCampaignPerformance(): Promise<CampaignPerformanceView[]> {
  const campaigns = await getCampaigns();
  return campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    contacts: campaign.contacts_count,
    calls: campaign.calls_count,
    answered: Math.round(campaign.calls_count * 0.72),
    appointments: campaign.appointments_count,
    conversionRate: campaign.contacts_count ? Number(((campaign.appointments_count / campaign.contacts_count) * 100).toFixed(1)) : 0,
    estimatedRevenue: campaign.estimated_revenue,
    status: campaign.status,
  }));
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const now = new Date().toISOString();
  const scheduledForLater = Boolean(input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now());
  const status: CampaignStatus = !input.launch ? "draft" : scheduledForLater ? "scheduled" : "active";

  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        name: input.name,
        type: input.type,
        status,
        channels: input.channels,
        audience_description: input.audienceDescription,
        scheduled_at: input.scheduledAt,
        started_at: status === "active" ? now : null,
        contacts_count: input.contactsCount,
        ai_script: input.aiScript,
      } as never)
      .select("*")
      .single();
    if (error) throw error;
    return mapCampaignRow(data);
  }

  const { campaigns } = getMockDataset();
  const campaign: Campaign = {
    id: `camp-${Math.random().toString(36).slice(2, 9)}`,
    organization_id: campaigns[0]?.organization_id ?? "org-maple-grove",
    name: input.name,
    type: input.type,
    status,
    channels: input.channels,
    audience_description: input.audienceDescription,
    scheduled_at: input.scheduledAt,
    started_at: status === "active" ? now : null,
    completed_at: null,
    contacts_count: input.contactsCount,
    calls_count: 0,
    sms_count: 0,
    responses_count: 0,
    appointments_count: 0,
    estimated_revenue: 0,
    ai_script: input.aiScript,
    created_at: now,
    updated_at: now,
  };
  campaigns.unshift(campaign);
  return campaign;
}

export async function updateCampaignStatus(id: string, status: CampaignStatus): Promise<void> {
  const now = new Date().toISOString();
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const patch: Database["public"]["Tables"]["campaigns"]["Update"] = { status };
    if (status === "active") patch.started_at = now;
    if (status === "completed") patch.completed_at = now;
    const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
    if (error) throw error;
    return;
  }
  const campaign = getMockDataset().campaigns.find((item) => item.id === id);
  if (!campaign) throw new Error("Campaign not found.");
  campaign.status = status;
  if (status === "active" && !campaign.started_at) campaign.started_at = now;
  if (status === "completed") campaign.completed_at = now;
  campaign.updated_at = now;
}

export async function deleteCampaign(id: string): Promise<void> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const dataset = getMockDataset();
  const index = dataset.campaigns.findIndex((item) => item.id === id);
  if (index >= 0) dataset.campaigns.splice(index, 1);
  dataset.campaignContacts = dataset.campaignContacts.filter((contact) => contact.campaign_id !== id);
}

function mapCampaignRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    type: row.type,
    status: row.status,
    channels: (row.channels ?? []) as CampaignChannel[],
    audience_description: row.audience_description ?? "",
    scheduled_at: row.scheduled_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    contacts_count: row.contacts_count,
    calls_count: row.calls_count,
    sms_count: row.sms_count,
    responses_count: row.responses_count,
    appointments_count: row.appointments_count,
    estimated_revenue: Number(row.estimated_revenue),
    ai_script: row.ai_script,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function withLiveCounts(
  campaign: Campaign,
  calls: { campaign_id: string | null; status: string }[],
  appointments: { campaign_id: string | null; status: string; estimated_value: number }[]
): Campaign {
  const relatedCalls = calls.filter((call) => call.campaign_id === campaign.id);
  const relatedAppointments = appointments.filter((appointment) => appointment.campaign_id === campaign.id && appointment.status !== "cancelled");
  if (relatedCalls.length === 0 && relatedAppointments.length === 0) return campaign;
  const responses = relatedCalls.filter((call) => call.status === "completed").length;
  const revenue = relatedAppointments.reduce((sum, appointment) => sum + Number(appointment.estimated_value), 0);
  return {
    ...campaign,
    calls_count: relatedCalls.length,
    responses_count: responses,
    appointments_count: relatedAppointments.length,
    estimated_revenue: revenue,
  };
}

async function audienceForDescription(description: string): Promise<AudiencePreview> {
  const preset = AUDIENCE_PRESETS.find((item) => item.label === description);
  if (!preset) return { label: description, contacts: [] };
  return previewAudience(preset.id);
}

async function loadAudienceSource(): Promise<{ patients: Patient[]; leads: Lead[]; appointments: Appointment[] }> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const [patientsResult, leadsResult, appointmentsResult] = await Promise.all([
      supabase.from("patients").select("*"),
      supabase.from("leads").select("*"),
      supabase.from("appointments").select("*"),
    ]);
    if (patientsResult.error) throw patientsResult.error;
    if (leadsResult.error) throw leadsResult.error;
    if (appointmentsResult.error) throw appointmentsResult.error;
    return {
      patients: (patientsResult.data ?? []).map(mapPatientRow),
      leads: (leadsResult.data ?? []).map(mapLeadRow),
      appointments: (appointmentsResult.data ?? []).map(mapAppointmentRow),
    };
  }
  const { patients, leads, appointments } = getMockDataset();
  return { patients, leads, appointments };
}

function matchAudience(preset: AudiencePreset, patients: Patient[], leads: Lead[], appointments: Appointment[]): AudiencePreview["contacts"] {
  if (preset === "inactive_6_months") {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return patients
      .filter((patient) => {
        if (patient.status === "inactive" || patient.status === "overdue_recall") return true;
        return Boolean(patient.last_appointment_at && new Date(patient.last_appointment_at).getTime() < cutoff.getTime());
      })
      .map((patient) => ({ id: patient.id, name: patient.full_name, phone: patient.phone }));
  }

  if (preset === "missed_appointments") {
    const seen = new Set<string>();
    const contacts: AudiencePreview["contacts"] = [];
    for (const appointment of appointments) {
      if (appointment.status !== "no_show") continue;
      const key = appointment.patient_id ?? appointment.patient_name;
      if (seen.has(key)) continue;
      seen.add(key);
      const patient = patients.find((item) => item.id === appointment.patient_id);
      contacts.push({
        id: appointment.patient_id ?? appointment.id,
        name: patient?.full_name || appointment.patient_name,
        phone: patient?.phone ?? "",
      });
    }
    return contacts;
  }

  const needle = preset === "implant_leads" ? "implant" : "invisalign";
  const seen = new Set<string>();
  return leads
    .filter((lead) => {
      const service = lead.service.toLowerCase();
      const open = !lead.appointment_id && lead.status !== "booked" && lead.status !== "completed" && lead.status !== "lost";
      return open && service.includes(needle);
    })
    .filter((lead) => {
      if (seen.has(lead.id)) return false;
      seen.add(lead.id);
      return true;
    })
    .map((lead) => ({ id: lead.patient_id ?? lead.id, name: lead.patient_name, phone: lead.phone }));
}

function previewToContacts(campaign: Campaign, preview: AudiencePreview): CampaignContact[] {
  return preview.contacts.map((contact) => ({
    id: `${campaign.id}-${contact.id}`,
    organization_id: campaign.organization_id,
    campaign_id: campaign.id,
    patient_id: contact.id,
    patient_name: contact.name,
    phone: contact.phone,
    status: "pending",
    contacted_at: null,
    responded_at: null,
    appointment_id: null,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
  }));
}

export function defaultCampaignName(type: CampaignType, now = new Date()): string {
  const date = now.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  return `${CAMPAIGN_TYPE_LABELS[type]} ${date}`;
}
