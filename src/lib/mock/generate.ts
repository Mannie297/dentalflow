import type {
  ActivityLog,
  ActivityType,
  AIInsight,
  Appointment,
  AppointmentStatus,
  Call,
  CallIntent,
  CallOutcome,
  Campaign,
  CampaignContact,
  Conversation,
  DentalServiceType,
  KnowledgeDocument,
  Lead,
  LeadSource,
  LeadStatus,
  Message,
  Patient,
} from "@/types";
import { SeededRandom } from "./seed";
import {
  DEMO_ORGANIZATION,
  DENTISTS,
  FIRST_NAMES,
  LAST_NAMES,
  SERVICE_WEIGHTS,
} from "./constants";

const ORG_ID = DEMO_ORGANIZATION.id;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of days of call/appointment history to generate behind "today". */
const HISTORY_DAYS = 196;
/** Number of days ahead of "today" to generate scheduled appointments. */
const FUTURE_DAYS = 14;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number, base: Date): Date {
  return new Date(startOfDay(base).getTime() - n * DAY_MS);
}

function atTime(date: Date, hour: number, minute: number): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

function fullPhoneNumber(rng: SeededRandom): string {
  const exchange = rng.int(200, 999);
  const line = rng.int(1000, 9999);
  return `(905) ${exchange}-${line}`;
}

export interface MockDataset {
  generatedAt: string;
  organization: typeof DEMO_ORGANIZATION;
  patients: Patient[];
  calls: Call[];
  leads: Lead[];
  appointments: Appointment[];
  campaigns: Campaign[];
  campaignContacts: CampaignContact[];
  activity: ActivityLog[];
  insights: AIInsight[];
  documents: KnowledgeDocument[];
  conversations: Conversation[];
  messages: Message[];
}

interface WeekdayProfile {
  isOpen: boolean;
  inboundBase: number;
  missedRateBoost: number;
  isHalfDay?: boolean;
}

// Sunday = 0 ... Saturday = 6
const WEEKDAY_PROFILES: WeekdayProfile[] = [
  { isOpen: false, inboundBase: 0, missedRateBoost: 0 }, // Sunday
  { isOpen: true, inboundBase: 7.4, missedRateBoost: 0.09 }, // Monday - busiest + more missed (opening rush)
  { isOpen: true, inboundBase: 6.1, missedRateBoost: 0.02 }, // Tuesday
  { isOpen: true, inboundBase: 5.8, missedRateBoost: 0.02 }, // Wednesday
  { isOpen: true, inboundBase: 5.9, missedRateBoost: 0.02 }, // Thursday
  { isOpen: true, inboundBase: 5.3, missedRateBoost: 0.015 }, // Friday
  { isOpen: true, inboundBase: 3.1, missedRateBoost: 0.01, isHalfDay: true }, // Saturday
];

const INTENT_WEIGHTS: { value: CallIntent; weight: number }[] = [
  { value: "new_patient_inquiry", weight: 24 },
  { value: "appointment_booking", weight: 20 },
  { value: "existing_patient", weight: 18 },
  { value: "appointment_reschedule", weight: 12 },
  { value: "emergency", weight: 10 },
  { value: "billing_insurance", weight: 9 },
  { value: "general_question", weight: 7 },
];

function pickOutcomeForIntent(rng: SeededRandom, intent: CallIntent): CallOutcome {
  const bookChance: Record<CallIntent, number> = {
    new_patient_inquiry: 0.46,
    appointment_booking: 0.78,
    appointment_reschedule: 0.58,
    emergency: 0.68,
    existing_patient: 0.3,
    billing_insurance: 0.05,
    general_question: 0.08,
    other: 0.1,
  };
  if (rng.bool(bookChance[intent])) return "booked";
  return rng.weightedPick<CallOutcome>([
    { value: "callback_requested", weight: 20 },
    { value: "information_provided", weight: 35 },
    { value: "transferred_to_staff", weight: 12 },
    { value: "voicemail", weight: 10 },
    { value: "no_action", weight: 18 },
    { value: "lost", weight: 5 },
  ]);
}

function durationForIntent(rng: SeededRandom, intent: CallIntent, outcome: CallOutcome | null): number {
  if (outcome === "booked") return rng.int(150, 340);
  if (intent === "emergency") return rng.int(120, 260);
  if (intent === "billing_insurance" || intent === "general_question") return rng.int(45, 140);
  return rng.int(60, 200);
}

function makeNewPatient(rng: SeededRandom, createdAt: Date, source: LeadSource): Patient {
  const firstName = rng.pick(FIRST_NAMES);
  const lastName = rng.pick(LAST_NAMES);
  return {
    id: nextId("pat"),
    organization_id: ORG_ID,
    full_name: `${firstName} ${lastName}`,
    phone: fullPhoneNumber(rng),
    email: rng.bool(0.75)
      ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${rng.pick(["gmail.com", "outlook.com", "yahoo.com", "icloud.com"])}`
      : null,
    patient_type: "new",
    status: "active",
    lead_source: source,
    last_appointment_at: null,
    next_appointment_at: null,
    estimated_value: 0,
    is_high_value: false,
    notes: null,
    ai_summary: null,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
  };
}

function makeExistingPatientPool(rng: SeededRandom, count: number, now: Date): Patient[] {
  const patients: Patient[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const createdDaysAgo = rng.int(200, 1200);
    const created = daysAgo(createdDaysAgo, now);
    patients.push({
      id: nextId("pat"),
      organization_id: ORG_ID,
      full_name: `${firstName} ${lastName}`,
      phone: fullPhoneNumber(rng),
      email: rng.bool(0.8)
        ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${rng.pick(["gmail.com", "outlook.com", "yahoo.com", "icloud.com"])}`
        : null,
      patient_type: "existing",
      status: "active",
      lead_source: rng.weightedPick<LeadSource>([
        { value: "referral", weight: 30 },
        { value: "inbound_call", weight: 25 },
        { value: "website", weight: 20 },
        { value: "walk_in", weight: 15 },
        { value: "campaign", weight: 10 },
      ]),
      last_appointment_at: daysAgo(rng.int(1, 260), now).toISOString(),
      next_appointment_at: null,
      estimated_value: 0,
      is_high_value: false,
      notes: null,
      ai_summary: null,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });
  }
  return patients;
}

function serviceAverageValue(service: DentalServiceType): number {
  const map: Record<DentalServiceType, number> = {
    general_cleaning: 180,
    emergency_dental: 350,
    dental_exam: 150,
    implants: 3200,
    invisalign: 5200,
    whitening: 420,
    crowns: 1350,
    root_canal: 980,
    childrens_dentistry: 160,
    other: 220,
  };
  return map[service];
}

export function buildMockDataset(seed = 20260811): MockDataset {
  idCounter = 0;
  const rng = new SeededRandom(seed);
  const now = new Date();

  const existingPatients = makeExistingPatientPool(rng, 140, now);
  const patients: Patient[] = [...existingPatients];
  const patientsById = new Map(patients.map((p) => [p.id, p]));

  const calls: Call[] = [];
  const leads: Lead[] = [];
  const appointments: Appointment[] = [];

  const campaigns = buildCampaigns(rng, now);

  // --- Generate calls day by day -------------------------------------------------
  for (let dayOffset = HISTORY_DAYS; dayOffset >= 0; dayOffset--) {
    const day = daysAgo(dayOffset, now);
    const weekday = day.getDay();
    const profile = WEEKDAY_PROFILES[weekday];
    if (!profile.isOpen) continue;

    // Slight upward growth trend as we approach "today" (recent period outperforms prior period).
    const trendFactor = 0.82 + 0.34 * (1 - dayOffset / HISTORY_DAYS);
    const dayNoise = rng.float(0.75, 1.25);
    const inboundCount = Math.max(0, Math.round(profile.inboundBase * trendFactor * dayNoise));

    for (let i = 0; i < inboundCount; i++) {
      const isMissed = rng.bool(0.062 + profile.missedRateBoost * (i < 2 ? 1.6 : 0.6));
      const hour = profile.isHalfDay ? rng.int(9, 12) : rng.int(8, 17);
      const minute = rng.int(0, 59);
      // Bias missed calls toward the 8-10am window on Mondays for a realistic, discoverable AI insight.
      const startedAt =
        weekday === 1 && isMissed && rng.bool(0.55)
          ? atTime(day, rng.int(8, 9), minute)
          : atTime(day, hour, minute);

      const intent = rng.weightedPick(INTENT_WEIGHTS);
      const status = isMissed ? "missed" : rng.bool(0.02) ? "transferred" : "completed";
      const outcome = status === "completed" ? pickOutcomeForIntent(rng, intent) : null;
      const durationSeconds = status === "completed" ? durationForIntent(rng, intent, outcome) : status === "transferred" ? rng.int(60, 160) : 0;

      const isNewPatientCall = intent === "new_patient_inquiry" && rng.bool(0.72);
      let patient: Patient | null = null;
      if (isNewPatientCall) {
        patient = makeNewPatient(rng, startedAt, "inbound_call");
        patients.push(patient);
        patientsById.set(patient.id, patient);
      } else if (rng.bool(0.68)) {
        patient = rng.pick(existingPatients);
      }

      const recoveredFromMissed = isMissed && rng.bool(0.42);

      const call: Call = {
        id: nextId("call"),
        organization_id: ORG_ID,
        patient_id: patient?.id ?? null,
        patient_name: patient?.full_name ?? (isMissed ? "Unknown Caller" : rng.pick(FIRST_NAMES) + " " + rng.pick(LAST_NAMES)),
        lead_id: null,
        direction: "inbound",
        phone_number: patient?.phone ?? fullPhoneNumber(rng),
        started_at: startedAt.toISOString(),
        ended_at: status === "missed" ? null : new Date(startedAt.getTime() + durationSeconds * 1000).toISOString(),
        duration_seconds: durationSeconds,
        status,
        intent,
        outcome,
        ai_summary: null,
        ai_handled: rng.bool(0.86),
        ai_confidence: rng.bool(0.86) ? Number(rng.float(0.78, 0.99).toFixed(2)) : null,
        appointment_id: null,
        recording_url: status !== "missed" ? "/mock/audio/sample-call.wav" : null,
        transcript_id: status !== "missed" ? nextId("transcript") : null,
        sentiment: rng.weightedPick([
          { value: "positive", weight: 55 },
          { value: "neutral", weight: 35 },
          { value: "negative", weight: 10 },
        ]),
        campaign_id: null,
        recovered_from_missed: recoveredFromMissed,
        created_at: startedAt.toISOString(),
        updated_at: startedAt.toISOString(),
      };
      calls.push(call);

      // Leads: born from calls that express real buying intent.
      const leadEligibleIntents: CallIntent[] = [
        "new_patient_inquiry",
        "appointment_booking",
        "appointment_reschedule",
        "emergency",
      ];
      if (status !== "missed" && leadEligibleIntents.includes(intent) && rng.bool(0.85)) {
        const service = rng.weightedPick(SERVICE_WEIGHTS);
        const leadStatus = deriveLeadStatus(rng, dayOffset, outcome);
        const lead: Lead = {
          id: nextId("lead"),
          organization_id: ORG_ID,
          patient_id: patient?.id ?? null,
          patient_name: call.patient_name ?? "Unknown",
          phone: call.phone_number,
          source: "inbound_call",
          service,
          status: leadStatus,
          lead_score: rng.int(35, 98),
          estimated_value: serviceAverageValue(service),
          priority: intent === "emergency" ? "high" : rng.weightedPick([
            { value: "high" as const, weight: 25 },
            { value: "medium" as const, weight: 50 },
            { value: "low" as const, weight: 25 },
          ]),
          first_contact_at: startedAt.toISOString(),
          last_contact_at: startedAt.toISOString(),
          next_action: nextActionForStatus(leadStatus),
          appointment_id: null,
          assigned_to: null,
          campaign_id: null,
          created_at: startedAt.toISOString(),
          updated_at: startedAt.toISOString(),
        };
        leads.push(lead);
        call.lead_id = lead.id;

        if (leadStatus === "booked" || leadStatus === "completed") {
          const appt = createAppointmentFromLead(rng, lead, startedAt, now, leadStatus);
          appointments.push(appt);
          lead.appointment_id = appt.id;
          call.appointment_id = appt.id;
          if (patient) {
            patient.next_appointment_at = appt.status === "completed" ? patient.next_appointment_at : appt.starts_at;
            patient.last_appointment_at = appt.status === "completed" ? appt.starts_at : patient.last_appointment_at;
            patient.estimated_value += appt.estimated_value;
          }
        }
      }

      // Website / chat leads (not tied to a call) sprinkled through the day.
      if (rng.bool(0.05)) {
        const service = rng.weightedPick(SERVICE_WEIGHTS);
        const contactAt = atTime(day, rng.int(7, 22), rng.int(0, 59));
        const source: LeadSource = rng.bool(0.6) ? "website" : "chat";
        const p = rng.bool(0.5) ? makeNewPatient(rng, contactAt, source) : null;
        if (p) {
          patients.push(p);
          patientsById.set(p.id, p);
        }
        const leadStatus = deriveLeadStatus(rng, dayOffset, null);
        const lead: Lead = {
          id: nextId("lead"),
          organization_id: ORG_ID,
          patient_id: p?.id ?? null,
          patient_name: p?.full_name ?? `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
          phone: p?.phone ?? fullPhoneNumber(rng),
          source,
          service,
          status: leadStatus,
          lead_score: rng.int(30, 90),
          estimated_value: serviceAverageValue(service),
          priority: rng.weightedPick([
            { value: "high" as const, weight: 20 },
            { value: "medium" as const, weight: 50 },
            { value: "low" as const, weight: 30 },
          ]),
          first_contact_at: contactAt.toISOString(),
          last_contact_at: contactAt.toISOString(),
          next_action: nextActionForStatus(leadStatus),
          appointment_id: null,
          assigned_to: null,
          campaign_id: null,
          created_at: contactAt.toISOString(),
          updated_at: contactAt.toISOString(),
        };
        leads.push(lead);
        if (leadStatus === "booked" || leadStatus === "completed") {
          const appt = createAppointmentFromLead(rng, lead, contactAt, now, leadStatus);
          appointments.push(appt);
          lead.appointment_id = appt.id;
        }
      }
    }

    // Outbound calls: campaign-driven follow-ups + missed call recovery attempts.
    const outboundCount = Math.round(rng.float(2, 5) * trendFactor);
    for (let i = 0; i < outboundCount; i++) {
      const hour = rng.int(9, 17);
      const startedAt = atTime(day, hour, rng.int(0, 59));
      const campaign = rng.bool(0.7) ? rng.pick(campaigns) : null;
      const patient = rng.pick(existingPatients);
      const status = rng.bool(0.78) ? "completed" : rng.bool(0.5) ? "missed" : "failed";
      const outcome = status === "completed" ? (rng.bool(0.32) ? "booked" : rng.pick<CallOutcome>(["information_provided", "callback_requested", "no_action", "voicemail"])) : null;
      const durationSeconds = status === "completed" ? rng.int(45, 210) : 0;

      const call: Call = {
        id: nextId("call"),
        organization_id: ORG_ID,
        patient_id: patient.id,
        patient_name: patient.full_name,
        lead_id: null,
        direction: "outbound",
        phone_number: patient.phone,
        started_at: startedAt.toISOString(),
        ended_at: status === "completed" ? new Date(startedAt.getTime() + durationSeconds * 1000).toISOString() : null,
        duration_seconds: durationSeconds,
        status,
        intent: campaign?.type === "recall" ? "existing_patient" : "appointment_reschedule",
        outcome,
        ai_summary: null,
        ai_handled: rng.bool(0.9),
        ai_confidence: rng.bool(0.9) ? Number(rng.float(0.8, 0.98).toFixed(2)) : null,
        appointment_id: null,
        recording_url: status === "completed" ? "/mock/audio/sample-call.wav" : null,
        transcript_id: status === "completed" ? nextId("transcript") : null,
        sentiment: rng.weightedPick([
          { value: "positive", weight: 50 },
          { value: "neutral", weight: 40 },
          { value: "negative", weight: 10 },
        ]),
        campaign_id: campaign?.id ?? null,
        recovered_from_missed: false,
        created_at: startedAt.toISOString(),
        updated_at: startedAt.toISOString(),
      };
      calls.push(call);

      if (outcome === "booked" && campaign) {
        const service = rng.weightedPick(SERVICE_WEIGHTS);
        const apptDate = daysAgo(rng.int(-FUTURE_DAYS, 10), now);
        const appt = buildAppointment(rng, {
          patientId: patient.id,
          patientName: patient.full_name,
          patientType: "existing",
          service,
          startsAt: atTime(apptDate, rng.int(9, 16), rng.pick([0, 15, 30, 45])),
          source: "campaign",
          campaignId: campaign.id,
          now,
          bookedAt: startedAt,
        });
        appointments.push(appt);
        call.appointment_id = appt.id;
      }
    }
  }

  // --- Future / upcoming appointments (recalls & confirmed bookings) --------------
  for (let dayOffset = 0; dayOffset <= FUTURE_DAYS; dayOffset++) {
    const day = daysAgo(-dayOffset, now);
    const weekday = day.getDay();
    const profile = WEEKDAY_PROFILES[weekday];
    if (!profile.isOpen) continue;
    const count = dayOffset === 0 ? rng.int(6, 10) : rng.int(4, 9);
    for (let i = 0; i < count; i++) {
      const patient = rng.pick(existingPatients);
      const service = rng.weightedPick(SERVICE_WEIGHTS);
      const hour = profile.isHalfDay ? rng.int(9, 12) : rng.int(8, 17);
      const appt = buildAppointment(rng, {
        patientId: patient.id,
        patientName: patient.full_name,
        patientType: rng.bool(0.3) ? "new" : "existing",
        service,
        startsAt: atTime(day, hour, rng.pick([0, 15, 30, 45])),
        source: "inbound_call",
        campaignId: null,
        now,
        forceStatus: dayOffset === 0 ? rng.weightedPick([
          { value: "confirmed" as AppointmentStatus, weight: 85 },
          { value: "completed" as AppointmentStatus, weight: 15 },
        ]) : rng.weightedPick([
          { value: "confirmed" as AppointmentStatus, weight: 65 },
          { value: "requested" as AppointmentStatus, weight: 35 },
        ]),
        // Bookings for upcoming visits are typically made in the days immediately before "now", not on the future visit date itself.
        bookedAt: daysAgo(rng.int(0, 6), now),
      });
      appointments.push(appt);
    }
  }

  const campaignContacts = buildCampaignContacts(rng, campaigns, existingPatients, now);
  const activity = buildActivityLog(rng, { calls, appointments, campaigns }, now);
  const insights = buildInsights({ calls, leads, appointments, now });
  const documents = buildKnowledgeDocuments(now);
  const { conversations, messages } = buildConversations(rng, existingPatients, now);

  return {
    generatedAt: now.toISOString(),
    organization: DEMO_ORGANIZATION,
    patients,
    calls: calls.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    leads: leads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    appointments: appointments.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    campaigns,
    campaignContacts,
    activity,
    insights,
    documents,
    conversations,
    messages,
  };
}

function deriveLeadStatus(rng: SeededRandom, dayOffset: number, outcome: CallOutcome | null): LeadStatus {
  if (outcome === "booked") {
    // Older bookings have had time to be completed.
    if (dayOffset > 5) return rng.bool(0.75) ? "completed" : "booked";
    return "booked";
  }
  if (outcome === "lost") return "lost";
  // Recency-weighted pipeline distribution for non-booked leads.
  if (dayOffset < 3) {
    return rng.weightedPick([
      { value: "new" as LeadStatus, weight: 45 },
      { value: "contacted" as LeadStatus, weight: 35 },
      { value: "qualified" as LeadStatus, weight: 20 },
    ]);
  }
  if (dayOffset < 14) {
    return rng.weightedPick([
      { value: "contacted" as LeadStatus, weight: 25 },
      { value: "qualified" as LeadStatus, weight: 30 },
      { value: "appointment_requested" as LeadStatus, weight: 25 },
      { value: "lost" as LeadStatus, weight: 20 },
    ]);
  }
  return rng.weightedPick([
    { value: "qualified" as LeadStatus, weight: 10 },
    { value: "appointment_requested" as LeadStatus, weight: 10 },
    { value: "completed" as LeadStatus, weight: 30 },
    { value: "lost" as LeadStatus, weight: 50 },
  ]);
}

function nextActionForStatus(status: LeadStatus): string | null {
  const map: Record<LeadStatus, string | null> = {
    new: "Send introductory SMS",
    contacted: "Follow up with call",
    qualified: "Offer appointment times",
    appointment_requested: "Confirm appointment slot",
    booked: "Send appointment reminder",
    completed: "Request review",
    lost: null,
  };
  return map[status];
}

function buildAppointment(
  rng: SeededRandom,
  opts: {
    patientId: string;
    patientName: string;
    patientType: "new" | "existing";
    service: DentalServiceType;
    startsAt: Date;
    source: LeadSource;
    campaignId: string | null;
    now: Date;
    forceStatus?: AppointmentStatus;
    /** When the appointment record was actually created/booked (defaults to startsAt if omitted). Kept distinct from `startsAt` so date-range filters on `created_at` reflect real booking activity, not the future visit date. */
    bookedAt?: Date;
  }
): Appointment {
  const durationMinutes = opts.service === "implants" || opts.service === "root_canal" ? 60 : opts.service === "invisalign" ? 45 : 30;
  const endsAt = new Date(opts.startsAt.getTime() + durationMinutes * 60000);
  let status: AppointmentStatus;
  if (opts.forceStatus) {
    status = opts.forceStatus;
  } else if (opts.startsAt.getTime() > opts.now.getTime()) {
    status = rng.weightedPick([
      { value: "confirmed" as AppointmentStatus, weight: 70 },
      { value: "requested" as AppointmentStatus, weight: 30 },
    ]);
  } else {
    status = rng.weightedPick([
      { value: "completed" as AppointmentStatus, weight: 78 },
      { value: "cancelled" as AppointmentStatus, weight: 12 },
      { value: "no_show" as AppointmentStatus, weight: 10 },
    ]);
  }
  return {
    id: nextId("appt"),
    organization_id: ORG_ID,
    patient_id: opts.patientId,
    patient_name: opts.patientName,
    patient_type: opts.patientType,
    service: opts.service,
    dentist_name: rng.pick(DENTISTS),
    starts_at: opts.startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status,
    source: opts.source,
    lead_id: null,
    call_id: null,
    campaign_id: opts.campaignId,
    estimated_value: serviceAverageValue(opts.service),
    notes: null,
    created_at: (opts.bookedAt ?? opts.startsAt).toISOString(),
    updated_at: (opts.bookedAt ?? opts.startsAt).toISOString(),
  };
}

function createAppointmentFromLead(rng: SeededRandom, lead: Lead, contactAt: Date, now: Date, leadStatus: LeadStatus): Appointment {
  const daysUntil = leadStatus === "completed" ? rng.int(2, 10) : rng.int(-FUTURE_DAYS, 5);
  const apptDate = new Date(contactAt.getTime() + daysUntil * DAY_MS);
  const appt = buildAppointment(rng, {
    patientId: lead.patient_id ?? nextId("pat"),
    patientName: lead.patient_name,
    patientType: lead.patient_id ? "existing" : "new",
    service: lead.service,
    startsAt: atTime(apptDate, rng.int(9, 16), rng.pick([0, 15, 30, 45])),
    source: lead.source,
    campaignId: lead.campaign_id,
    now,
    forceStatus: leadStatus === "completed" ? "completed" : undefined,
    bookedAt: contactAt,
  });
  appt.lead_id = lead.id;
  return appt;
}

function buildCampaigns(rng: SeededRandom, now: Date): Campaign[] {
  const defs: { name: string; type: Campaign["type"]; status: Campaign["status"]; channels: Campaign["channels"]; audience: string; daysAgoStart: number | null }[] = [
    {
      name: "Overdue Cleaning Recall",
      type: "recall",
      status: "active",
      channels: ["sms", "ai_voice"],
      audience: "Patients inactive for more than 6 months",
      daysAgoStart: 9,
    },
    {
      name: "Missed Appointment Recovery",
      type: "missed_call_recovery",
      status: "active",
      channels: ["sms", "ai_voice"],
      audience: "Patients who missed a scheduled appointment",
      daysAgoStart: 5,
    },
    {
      name: "Implant Follow-up",
      type: "treatment_follow_up",
      status: "completed",
      channels: ["ai_voice", "email"],
      audience: "Implant leads without a booked appointment",
      daysAgoStart: 24,
    },
    {
      name: "Invisalign Follow-up",
      type: "treatment_follow_up",
      status: "active",
      channels: ["sms", "email"],
      audience: "Invisalign leads without a booked appointment",
      daysAgoStart: 12,
    },
    {
      name: "5-Star Review Requests",
      type: "review_request",
      status: "scheduled",
      channels: ["sms"],
      audience: "Patients seen in the last 7 days",
      daysAgoStart: null,
    },
  ];

  return defs.map((d) => {
    const contacts = rng.int(35, 220);
    const callRate = rng.float(0.55, 0.85);
    const calls = Math.round(contacts * callRate);
    const answered = Math.round(calls * rng.float(0.6, 0.85));
    const sms = d.channels.includes("sms") ? Math.round(contacts * rng.float(0.7, 1)) : 0;
    const responses = Math.round((answered + sms) * rng.float(0.18, 0.35));
    const appointmentsCount = Math.round(responses * rng.float(0.25, 0.5));
    const avgValue = rng.int(180, 2400);
    return {
      id: nextId("camp"),
      organization_id: ORG_ID,
      name: d.name,
      type: d.type,
      status: d.status,
      channels: d.channels,
      audience_description: d.audience,
      scheduled_at: d.status === "scheduled" ? daysAgo(-3, now).toISOString() : null,
      started_at: d.daysAgoStart !== null ? daysAgo(d.daysAgoStart, now).toISOString() : null,
      completed_at: d.status === "completed" ? daysAgo(2, now).toISOString() : null,
      contacts_count: contacts,
      calls_count: calls,
      sms_count: sms,
      responses_count: responses,
      appointments_count: appointmentsCount,
      estimated_revenue: appointmentsCount * avgValue,
      ai_script: `Hi {{patient_first_name}}, this is the virtual assistant from Maple Grove Dental Clinic calling about ${d.audience.toLowerCase()}. Would you like us to help you find a convenient time to come in?`,
      created_at: daysAgo((d.daysAgoStart ?? 3) + 2, now).toISOString(),
      updated_at: now.toISOString(),
    } satisfies Campaign;
  });
}

function buildCampaignContacts(rng: SeededRandom, campaigns: Campaign[], patients: Patient[], now: Date): CampaignContact[] {
  const contacts: CampaignContact[] = [];
  for (const campaign of campaigns) {
    const sampleSize = Math.min(campaign.contacts_count, 40);
    for (let i = 0; i < sampleSize; i++) {
      const patient = rng.pick(patients);
      const status = rng.weightedPick<CampaignContact["status"]>([
        { value: "pending", weight: 15 },
        { value: "contacted", weight: 30 },
        { value: "responded", weight: 25 },
        { value: "booked", weight: 20 },
        { value: "opted_out", weight: 5 },
        { value: "failed", weight: 5 },
      ]);
      contacts.push({
        id: nextId("cc"),
        organization_id: ORG_ID,
        campaign_id: campaign.id,
        patient_id: patient.id,
        patient_name: patient.full_name,
        phone: patient.phone,
        status,
        contacted_at: status !== "pending" ? daysAgo(rng.int(0, 10), now).toISOString() : null,
        responded_at: ["responded", "booked"].includes(status) ? daysAgo(rng.int(0, 8), now).toISOString() : null,
        appointment_id: null,
        created_at: daysAgo(rng.int(0, 12), now).toISOString(),
        updated_at: now.toISOString(),
      });
    }
  }
  return contacts;
}

function buildActivityLog(
  rng: SeededRandom,
  data: { calls: Call[]; appointments: Appointment[]; campaigns: Campaign[] },
  now: Date
): ActivityLog[] {
  const items: ActivityLog[] = [];
  const recentCalls = data.calls.filter((c) => new Date(c.started_at).getTime() > now.getTime() - 6 * 60 * 60 * 1000);

  for (const call of recentCalls.slice(0, 18)) {
    let type: ActivityType;
    let description: string;
    let status: ActivityLog["status"];
    if (call.status === "missed" && call.recovered_from_missed) {
      type = "call_recovered";
      description = "Missed call recovered via automated SMS follow-up";
      status = "success";
    } else if (call.status === "missed") {
      type = "call_missed";
      description = `Missed ${call.direction} call`;
      status = "warning";
    } else if (call.outcome === "booked") {
      type = "appointment_booked";
      description = call.ai_handled ? "AI receptionist booked a new appointment" : "Staff booked a new appointment";
      status = "success";
    } else {
      type = "call_completed";
      description = `${call.ai_handled ? "AI receptionist" : "Staff"} handled a ${call.direction} call`;
      status = "info";
    }
    items.push({
      id: nextId("act"),
      organization_id: ORG_ID,
      type,
      description,
      patient_name: call.patient_name,
      status,
      actor: call.ai_handled ? "ai" : "staff",
      created_at: call.started_at,
      updated_at: call.started_at,
    });
  }

  for (const appt of data.appointments.filter((a) => new Date(a.starts_at) > daysAgo(1, now) && new Date(a.starts_at) < now)) {
    items.push({
      id: nextId("act"),
      organization_id: ORG_ID,
      type: "appointment_reminder_sent",
      description: `Appointment reminder sent for ${appt.service.replace("_", " ")}`,
      patient_name: appt.patient_name,
      status: "info",
      actor: "system",
      created_at: appt.starts_at,
      updated_at: appt.starts_at,
    });
  }

  const completedCampaign = data.campaigns.find((c) => c.status === "completed");
  if (completedCampaign) {
    items.push({
      id: nextId("act"),
      organization_id: ORG_ID,
      type: "campaign_completed",
      description: `Outbound recall campaign "${completedCampaign.name}" completed`,
      patient_name: null,
      status: "success",
      actor: "system",
      created_at: completedCampaign.completed_at ?? now.toISOString(),
      updated_at: now.toISOString(),
    });
  }

  items.push({
    id: nextId("act"),
    organization_id: ORG_ID,
    type: "review_requested",
    description: "Review request sent",
    patient_name: rng.pick(data.calls).patient_name,
    status: "info",
    actor: "system",
    created_at: daysAgo(0, now).toISOString(),
    updated_at: now.toISOString(),
  });

  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
}

function buildInsights(data: { calls: Call[]; leads: Lead[]; appointments: Appointment[]; now: Date }): AIInsight[] {
  const insights: AIInsight[] = [];
  const last30 = data.calls.filter((c) => new Date(c.started_at).getTime() > data.now.getTime() - 30 * DAY_MS);

  // Monday missed-call insight
  const mondayCalls = last30.filter((c) => new Date(c.started_at).getDay() === 1);
  const mondayMissed = mondayCalls.filter((c) => c.status === "missed").length;
  const mondayMissedRate = mondayCalls.length ? (mondayMissed / mondayCalls.length) * 100 : 0;
  const otherCalls = last30.filter((c) => new Date(c.started_at).getDay() !== 1);
  const otherMissedRate = otherCalls.length ? (otherCalls.filter((c) => c.status === "missed").length / otherCalls.length) * 100 : 0;
  const mondayDelta = mondayMissedRate - otherMissedRate;
  if (mondayDelta > 2) {
    insights.push(
      makeInsight({
        category: "calls",
        severity: mondayDelta > 8 ? "warning" : "information",
        title: "Missed calls spike on Monday mornings",
        description: `Missed calls are ${mondayDelta.toFixed(0)}% higher on Mondays between 8–10 AM than the rest of the week, likely due to weekend voicemail backlog.`,
        recommendation: "Add an extra front-desk shift or enable AI overflow coverage for the Monday morning opening window.",
        metric: "Monday missed call rate",
        metric_value: `${mondayMissedRate.toFixed(1)}%`,
      })
    );
  }

  // Emergency vs general booking rate
  const emergencyLeads = data.leads.filter((l) => l.service === "emergency_dental");
  const generalLeads = data.leads.filter((l) => l.service === "general_cleaning" || l.service === "dental_exam");
  const bookRate = (arr: Lead[]) => (arr.length ? (arr.filter((l) => ["booked", "completed"].includes(l.status)).length / arr.length) * 100 : 0);
  const emergencyRate = bookRate(emergencyLeads);
  const generalRate = bookRate(generalLeads);
  if (emergencyRate > generalRate && generalRate > 0) {
    const diff = ((emergencyRate - generalRate) / generalRate) * 100;
    insights.push(
      makeInsight({
        category: "conversion",
        severity: "opportunity",
        title: "Emergency inquiries convert far better than general inquiries",
        description: `Emergency dental inquiries have a ${diff.toFixed(0)}% higher booking rate than general inquiries this period.`,
        recommendation: "Prioritize same-day emergency slots and make sure the AI receptionist always offers one immediately.",
        metric: "Emergency vs. general booking rate",
        metric_value: `${emergencyRate.toFixed(0)}% vs ${generalRate.toFixed(0)}%`,
      })
    );
  }

  // Missed call recovery via SMS
  const recovered = last30.filter((c) => c.status === "missed" && c.recovered_from_missed).length;
  if (recovered > 0) {
    insights.push(
      makeInsight({
        category: "operations",
        severity: "opportunity",
        title: "Automated SMS follow-up is recovering lost patients",
        description: `${recovered} missed calls were recovered through automated SMS follow-up in the last 30 days.`,
        recommendation: "Extend the same automated follow-up sequence to missed calls after hours and on weekends.",
        metric: "Missed calls recovered",
        metric_value: `${recovered}`,
      })
    );
  }

  // Top revenue-opportunity service
  const byService = new Map<string, number>();
  for (const l of data.leads) {
    byService.set(l.service, (byService.get(l.service) ?? 0) + l.estimated_value);
  }
  const topService = [...byService.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topService) {
    insights.push(
      makeInsight({
        category: "revenue",
        severity: "opportunity",
        title: `${formatServiceName(topService[0])} inquiries are your top revenue opportunity`,
        description: `${formatServiceName(topService[0])} inquiries generated the highest estimated revenue opportunity of any service this month.`,
        recommendation: `Ensure the AI receptionist and follow-up campaigns prioritize fast response times for ${formatServiceName(topService[0]).toLowerCase()} leads.`,
        metric: "Estimated opportunity",
        metric_value: `$${Math.round(topService[1]).toLocaleString("en-CA")}`,
      })
    );
  }

  // Cancellation trend
  const period = (from: number, to: number) => data.appointments.filter((a) => {
    const t = new Date(a.starts_at).getTime();
    return t >= from && t < to;
  });
  const currentPeriod = period(data.now.getTime() - 30 * DAY_MS, data.now.getTime());
  const priorPeriod = period(data.now.getTime() - 60 * DAY_MS, data.now.getTime() - 30 * DAY_MS);
  const cancelRate = (arr: Appointment[]) => (arr.length ? (arr.filter((a) => a.status === "cancelled").length / arr.length) * 100 : 0);
  const currentCancelRate = cancelRate(currentPeriod);
  const priorCancelRate = cancelRate(priorPeriod);
  if (currentCancelRate > priorCancelRate && priorCancelRate > 0) {
    const change = ((currentCancelRate - priorCancelRate) / priorCancelRate) * 100;
    insights.push(
      makeInsight({
        category: "appointments",
        severity: change > 15 ? "warning" : "information",
        title: "Appointment cancellations trending up",
        description: `Appointment cancellations increased ${change.toFixed(0)}% compared with the previous period.`,
        recommendation: "Enable automated 48-hour and 2-hour reminder sequences to reduce late cancellations.",
        metric: "Cancellation rate",
        metric_value: `${currentCancelRate.toFixed(1)}%`,
      })
    );
  }

  // Unbooked high-value leads
  const unbookedImplants = data.leads.filter((l) => l.service === "implants" && !["booked", "completed", "lost"].includes(l.status));
  if (unbookedImplants.length > 3) {
    insights.push(
      makeInsight({
        category: "patients",
        severity: "critical",
        title: `${unbookedImplants.length} implant leads have no booked appointment`,
        description: `There are ${unbookedImplants.length} unbooked implant inquiries representing significant revenue at risk of going cold.`,
        recommendation: "Launch a targeted implant follow-up campaign this week before these leads go cold.",
        metric: "Unbooked implant leads",
        metric_value: `${unbookedImplants.length}`,
      })
    );
  }

  return insights;
}

function formatServiceName(key: string): string {
  return key
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function makeInsight(opts: {
  category: AIInsight["category"];
  severity: AIInsight["severity"];
  title: string;
  description: string;
  recommendation: string;
  metric: string;
  metric_value: string;
}): AIInsight {
  return {
    id: nextId("insight"),
    organization_id: ORG_ID,
    category: opts.category,
    severity: opts.severity,
    title: opts.title,
    description: opts.description,
    recommendation: opts.recommendation,
    metric: opts.metric,
    metric_value: opts.metric_value,
    status: "new",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildKnowledgeDocuments(now: Date): KnowledgeDocument[] {
  const defs: { name: string; category: KnowledgeDocument["category"]; type: KnowledgeDocument["file_type"]; chunks: number; status: KnowledgeDocument["status"] }[] = [
    { name: "New Patient Welcome Packet.pdf", category: "patient_instructions", type: "pdf", chunks: 24, status: "indexed" },
    { name: "Clinic Hours & Policies.docx", category: "clinic_policies", type: "docx", chunks: 12, status: "indexed" },
    { name: "Services & Pricing Guide 2026.pdf", category: "pricing", type: "pdf", chunks: 31, status: "indexed" },
    { name: "Accepted Insurance Providers.csv", category: "insurance", type: "csv", chunks: 8, status: "indexed" },
    { name: "Emergency Dental Procedures.pdf", category: "emergency_procedures", type: "pdf", chunks: 15, status: "indexed" },
    { name: "Frequently Asked Questions.txt", category: "faqs", type: "txt", chunks: 19, status: "indexed" },
    { name: "Invisalign Financing Options.pdf", category: "pricing", type: "pdf", chunks: 11, status: "processing" },
    { name: "Cancellation & No-Show Policy.docx", category: "clinic_policies", type: "docx", chunks: 6, status: "indexed" },
  ];
  return defs.map((d, i) => ({
    id: nextId("doc"),
    organization_id: ORG_ID,
    file_name: d.name,
    file_type: d.type,
    category: d.category,
    status: d.status,
    chunk_count: d.chunks,
    file_size_bytes: (i + 1) * 128_000,
    uploaded_by: "user-owner",
    created_at: daysAgo(20 - i * 2, now).toISOString(),
    updated_at: daysAgo(20 - i * 2, now).toISOString(),
  }));
}

function buildConversations(rng: SeededRandom, patients: Patient[], now: Date): { conversations: Conversation[]; messages: Message[] } {
  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  const sample = rng.shuffle(patients).slice(0, 24);
  for (const patient of sample) {
    const channel = rng.pick(["sms", "email"] as const);
    const conversationId = nextId("conv");
    const messageCount = rng.int(2, 5);
    let lastMessage = "";
    let lastAt = daysAgo(rng.int(0, 20), now);
    for (let i = 0; i < messageCount; i++) {
      const direction = i % 2 === 0 ? "outbound" : "inbound";
      const body =
        direction === "outbound"
          ? rng.pick([
              "Hi! This is Maple Grove Dental Clinic confirming your upcoming appointment.",
              "We noticed you missed our call — would you like to book a time to speak with our team?",
              "It's time for your 6-month cleaning. Would you like to schedule your next visit?",
              "Thanks for reaching out about Invisalign! Would you like a free consultation?",
            ])
          : rng.pick([
              "Yes, that works for me, thank you!",
              "Can we move it to next week instead?",
              "Yes please, what times are available?",
              "I have a few questions about financing first.",
            ]);
      lastMessage = body;
      lastAt = new Date(lastAt.getTime() + i * 3_600_000);
      messages.push({
        id: nextId("msg"),
        organization_id: ORG_ID,
        conversation_id: conversationId,
        patient_id: patient.id,
        channel,
        direction,
        body,
        sent_at: lastAt.toISOString(),
        status: "delivered",
        created_at: lastAt.toISOString(),
        updated_at: lastAt.toISOString(),
      });
    }
    conversations.push({
      id: conversationId,
      organization_id: ORG_ID,
      patient_id: patient.id,
      patient_name: patient.full_name,
      channel,
      last_message_at: lastAt.toISOString(),
      last_message_preview: lastMessage,
      created_at: lastAt.toISOString(),
      updated_at: lastAt.toISOString(),
    });
  }
  return { conversations, messages };
}
