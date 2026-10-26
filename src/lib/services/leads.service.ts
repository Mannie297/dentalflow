import type { DentalServiceType, Lead, LeadFunnel, LeadSource, LeadStatus } from "@/types";
import { LEAD_STAGES } from "@/types";
import { isWithinRange } from "@/lib/date-range";
import { getMockDataset } from "@/lib/mock";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapLeadRow } from "@/lib/supabase/mappers";

export interface LeadFilters {
  from?: string;
  to?: string;
  status?: LeadStatus;
  service?: DentalServiceType;
  source?: LeadSource;
  campaignId?: string;
  search?: string;
}

async function getLeadsFromSupabase(filters: LeadFilters): Promise<Lead[]> {
  const supabase = getSupabaseBrowserClient();
  // RLS scopes every query to the signed-in user's organization automatically --
  // no need to filter by organization_id client-side.
  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

  if (filters.from && filters.to) {
    query = query.gte("created_at", filters.from).lte("created_at", filters.to);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.service) query = query.eq("service_requested", filters.service);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`first_name.ilike.${term},last_name.ilike.${term},phone.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapLeadRow);
}

export async function getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  if (getCurrentDataSource() === "supabase") {
    return getLeadsFromSupabase(filters);
  }
  const { leads } = getMockDataset();
  let result = leads;
  if (filters.from && filters.to) {
    result = result.filter((l) => isWithinRange(l.created_at, filters.from!, filters.to!));
  }
  if (filters.status) result = result.filter((l) => l.status === filters.status);
  if (filters.service) result = result.filter((l) => l.service === filters.service);
  if (filters.source) result = result.filter((l) => l.source === filters.source);
  if (filters.campaignId) result = result.filter((l) => l.campaign_id === filters.campaignId);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((l) => l.patient_name.toLowerCase().includes(q) || l.phone.includes(q));
  }
  return result;
}

export async function getLead(id: string): Promise<Lead | null> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapLeadRow(data) : null;
  }
  const { leads } = getMockDataset();
  return leads.find((l) => l.id === id) ?? null;
}

export async function getLeadFunnel(filters: { from?: string; to?: string } = {}): Promise<LeadFunnel> {
  const leads = await getLeads(filters);
  const stages = LEAD_STAGES.map((status, index) => {
    const count = leads.filter((l) => l.status === status).length;
    return { status, count, conversionFromPrevious: null as number | null, index };
  });

  // Conversion is computed relative to total leads entering the pipeline (excludes "lost" as a funnel step reference).
  const totalLeads = leads.length;
  const stagesWithConversion = stages.map((s, i) => ({
    status: s.status,
    count: s.count,
    conversionFromPrevious: i === 0 || totalLeads === 0 ? null : Number(((s.count / totalLeads) * 100).toFixed(1)),
  }));

  return { stages: stagesWithConversion, totalLeads };
}

/** Updates a lead's pipeline stage. In mock mode this mutates the in-memory dataset for the current session only. */
export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead | null> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapLeadRow(data) : null;
  }
  const { leads } = getMockDataset();
  const index = leads.findIndex((l) => l.id === id);
  if (index === -1) return null;
  // Replace (rather than mutate) the array element so React Query's structural sharing detects a real
  // change -- mutating in place leaves every element referentially identical between fetches, causing
  // the query to be treated as unchanged and dependent components to silently skip re-rendering.
  const updated: Lead = { ...leads[index], status, updated_at: new Date().toISOString() };
  leads[index] = updated;
  return updated;
}
