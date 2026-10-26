/**
 * Central runtime configuration.
 *
 * `appConfig.dataSource` reflects the BUILD-TIME default (`NEXT_PUBLIC_DATA_SOURCE`):
 *  - "mock"     -- the deployment only ever has demo data available (default).
 *  - "supabase" -- the deployment is Supabase-only; Demo Mode is disabled entirely.
 *
 * `getActiveDataSource()` is what the service layer (`src/lib/services`) should
 * actually call. It additionally honors a RUNTIME Demo/Live toggle
 * (`useUIStore.isDemoMode`, exposed in the topbar) so a single Supabase-connected
 * deployment can switch between Demo Mode and Live Mode without a rebuild --
 * this is the switch the deployment prompt's "Phase 7 -- Demo Mode" and the
 * end-to-end test's "Switch to Live Mode" step depend on.
 *
 * No UI component should ever read `process.env.NEXT_PUBLIC_DATA_SOURCE`
 * directly -- always go through `getActiveDataSource()`.
 */
export type DataSource = "mock" | "supabase";

function resolveDataSource(): DataSource {
  const envValue = process.env.NEXT_PUBLIC_DATA_SOURCE;
  if (envValue === "supabase") return "supabase";
  return "mock";
}

export const appConfig = {
  dataSource: resolveDataSource(),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Server-only. Never read from a Client Component -- see src/lib/supabase/admin.ts.
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  // Where the frontend posts new lead-intake submissions. Points at an n8n
  // "CORE -- Lead Intake" webhook -- see /docs/N8N_WORKFLOWS.md. Left blank by
  // default so lead submission fails loudly (not silently) until configured.
  n8nLeadWebhookUrl: process.env.NEXT_PUBLIC_N8N_LEAD_WEBHOOK_URL ?? "",
  // Optional. When set, Live Mode "Log call" posts here instead of writing the
  // call directly. Points at n8n "CORE -- Call Intake".
  n8nCallWebhookUrl: process.env.NEXT_PUBLIC_N8N_CALL_WEBHOOK_URL ?? "",
  // Live Mode "Call back" posts here. Points at n8n "ElevenLabs — Outbound Call".
  n8nOutboundWebhookUrl: process.env.NEXT_PUBLIC_N8N_OUTBOUND_WEBHOOK_URL ?? "",
  defaultOrganizationId: process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? "",
  appName: "DentalFlow AI",
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(appConfig.supabaseUrl && appConfig.supabaseAnonKey);
}

export function isN8nLeadIntakeConfigured(): boolean {
  return Boolean(appConfig.n8nLeadWebhookUrl);
}

export function isN8nCallIntakeConfigured(): boolean {
  return Boolean(appConfig.n8nCallWebhookUrl);
}

export function isN8nOutboundConfigured(): boolean {
  return Boolean(appConfig.n8nOutboundWebhookUrl);
}

/**
 * Resolves which data source the service layer should use for THIS call.
 *
 * - If Supabase isn't configured at all, there's nothing to connect to --
 *   always fall back to mock data regardless of any runtime toggle.
 * - If the deployment is pinned to Supabase via `NEXT_PUBLIC_DATA_SOURCE=supabase`,
 *   always use Supabase (no Demo Mode available in this deployment).
 * - Otherwise, defer to the caller-supplied runtime flag (the UI's Demo/Live
 *   toggle). Defaults to "mock" if no override is supplied, so server-rendered
 *   output and any caller that forgets to pass the flag stay safely in Demo Mode.
 */
export function getActiveDataSource(isDemoModeOverride?: boolean): DataSource {
  if (!isSupabaseConfigured()) return "mock";
  if (appConfig.dataSource === "supabase") return "supabase";
  return isDemoModeOverride === false ? "supabase" : "mock";
}
