import type { AppUser, Organization } from "@/types";
import { DENTAL_SERVICE_LABELS } from "@/types";
import { getMockDataset } from "@/lib/mock";
import { DEMO_USERS } from "@/lib/mock/current-user";
import { EMERGENCY_POLICY } from "@/lib/mock/constants";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface BusinessHours {
  day: string;
  open: string;
  close: string;
  isOpen: boolean;
}

export type AfterHoursBehavior = "voicemail_ai" | "voicemail_human" | "emergency_transfer";

export const AFTER_HOURS_LABELS: Record<AfterHoursBehavior, string> = {
  voicemail_ai: "AI takes a message",
  voicemail_human: "Ask them to call back during business hours",
  emergency_transfer: "Follow the emergency policy and offer the transfer number",
};

export interface AIReceptionistSettings {
  enabled: boolean;
  businessHours: BusinessHours[];
  afterHoursBehavior: AfterHoursBehavior;
  transferNumber: string;
  emergencyPolicy: string;
  servicesSummary: string;
  insuranceNote: string;
  paymentOptions: string;
  financingNote: string;
  cancellationPolicy: string;
  bookingRules: string;
  transferRules: string;
  pricingNote: string;
}

export interface ClinicProfileInput {
  name: string;
  address_line1: string;
  city: string;
  province: string;
  postal_code: string;
  phone: string;
}

const SETTINGS_TEMPLATE = "ai_receptionist_config";

const DEFAULT_HOURS: BusinessHours[] = [
  { day: "Monday", open: "08:00", close: "18:00", isOpen: true },
  { day: "Tuesday", open: "08:00", close: "18:00", isOpen: true },
  { day: "Wednesday", open: "08:00", close: "18:00", isOpen: true },
  { day: "Thursday", open: "08:00", close: "18:00", isOpen: true },
  { day: "Friday", open: "08:00", close: "17:00", isOpen: true },
  { day: "Saturday", open: "09:00", close: "13:00", isOpen: true },
  { day: "Sunday", open: "00:00", close: "00:00", isOpen: false },
];

export const DEFAULT_AI_SETTINGS: AIReceptionistSettings = {
  enabled: true,
  businessHours: DEFAULT_HOURS,
  afterHoursBehavior: "emergency_transfer",
  transferNumber: "(905) 555-0148",
  emergencyPolicy: EMERGENCY_POLICY,
  servicesSummary: Object.entries(DENTAL_SERVICE_LABELS)
    .filter(([type]) => type !== "other")
    .map(([, label]) => label)
    .join(", "),
  insuranceNote: "Do not guess insurance coverage. Offer to have the front desk check the patient's plan.",
  paymentOptions: "Payment is taken at the visit. Do not quote a price unless it is written in the pricing field.",
  financingNote: "Do not describe financing terms unless they are written here.",
  cancellationPolicy: "Ask the patient to call the clinic to change or cancel a visit.",
  bookingRules: "Offer times only for the services listed here. If the request is unclear, transfer to the front desk.",
  transferRules: "Transfer when the caller asks for a person, describes a dental emergency, or asks something these rules do not cover.",
  pricingNote: "",
};

let mockSettings: AIReceptionistSettings | null = null;

export async function getOrganization(): Promise<Organization> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No clinic is available for this account.");
    return {
      id: data.id,
      organization_id: data.id,
      name: data.name,
      slug: data.slug,
      city: data.city ?? "",
      province: data.province ?? "",
      postal_code: data.postal_code ?? "",
      address_line1: data.address_line1 ?? "",
      phone: data.phone ?? "",
      timezone: data.timezone,
      logo_url: data.logo_url,
      plan: data.plan,
      demo: data.demo,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
  return { ...getMockDataset().organization };
}

export async function getOrganizationUsers(): Promise<AppUser[]> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("profiles").select("*").order("full_name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((profile) => ({
      id: profile.id,
      organization_id: profile.organization_id,
      auth_user_id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      title: profile.title,
      avatar_url: profile.avatar_url,
      is_active: profile.is_active,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    }));
  }
  return DEMO_USERS;
}

export async function getAIReceptionistSettings(): Promise<AIReceptionistSettings> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("system_prompt")
      .eq("name", SETTINGS_TEMPLATE)
      .not("organization_id", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.system_prompt) return structuredClone(DEFAULT_AI_SETTINGS);
    return parseSettings(data.system_prompt);
  }
  if (!mockSettings) mockSettings = structuredClone(DEFAULT_AI_SETTINGS);
  return structuredClone(mockSettings);
}

export async function saveReceptionistConfiguration(input: { settings: AIReceptionistSettings; clinic: ClinicProfileInput }): Promise<void> {
  const settings = normalizeSettings(input.settings);
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const organization = await getOrganization();
    const { error: orgError } = await supabase
      .from("organizations")
      .update({
        name: input.clinic.name.trim(),
        address_line1: input.clinic.address_line1.trim(),
        city: input.clinic.city.trim(),
        province: input.clinic.province.trim(),
        postal_code: input.clinic.postal_code.trim(),
        phone: input.clinic.phone.trim(),
      })
      .eq("id", organization.id);
    if (orgError) throw new Error(orgError.message);

    const existing = await supabase
      .from("prompt_templates")
      .select("id")
      .eq("name", SETTINGS_TEMPLATE)
      .not("organization_id", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    const payload = {
      system_prompt: JSON.stringify(settings),
      purpose: "Clinic rules for the AI receptionist. Do not diagnose, prescribe, or invent prices or insurance coverage.",
      active: true,
    };
    if (existing.data) {
      const { error } = await supabase.from("prompt_templates").update(payload).eq("id", existing.data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("prompt_templates").insert({
        organization_id: organization.id,
        name: SETTINGS_TEMPLATE,
        version: 1,
        model: "clinic-rules",
        temperature: 0,
        ...payload,
      });
      if (error) throw new Error(error.message);
    }
    return;
  }

  mockSettings = structuredClone(settings);
  const organization = getMockDataset().organization;
  organization.name = input.clinic.name.trim();
  organization.address_line1 = input.clinic.address_line1.trim();
  organization.city = input.clinic.city.trim();
  organization.province = input.clinic.province.trim();
  organization.postal_code = input.clinic.postal_code.trim();
  organization.phone = input.clinic.phone.trim();
}

function parseSettings(raw: string): AIReceptionistSettings {
  try {
    const parsed = JSON.parse(raw) as Partial<AIReceptionistSettings>;
    return normalizeSettings({ ...structuredClone(DEFAULT_AI_SETTINGS), ...parsed });
  } catch {
    return structuredClone(DEFAULT_AI_SETTINGS);
  }
}

function normalizeSettings(settings: AIReceptionistSettings): AIReceptionistSettings {
  const hours = Array.isArray(settings.businessHours) && settings.businessHours.length === 7 ? settings.businessHours : DEFAULT_HOURS;
  return { ...settings, businessHours: hours.map((day) => ({ ...day })) };
}
