/**
 * Service-role Supabase client -- SERVER-ONLY. Bypasses Row Level Security.
 *
 * NEVER import this module from a Client Component, a hook, or anything that
 * ends up in the browser bundle. It reads `SUPABASE_SERVICE_ROLE_KEY`, which
 * is deliberately NOT prefixed with `NEXT_PUBLIC_` so Next.js refuses to
 * inline it into client bundles. The runtime guard below is a second line of
 * defense in case this module is ever imported from the wrong place.
 *
 * Intended use: trusted server-side code only (Route Handlers, Server
 * Actions) that needs to write data on behalf of a system process rather
 * than an authenticated end user -- e.g. the `/api/events` callback that
 * n8n posts automation results to.
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
import type { Database } from "./database.types";

let adminClient: SupabaseClient<Database> | null = null;

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseAdminClient() must never be called from the browser.");
  }
  if (!appConfig.supabaseUrl || !appConfig.supabaseServiceRoleKey) {
    throw new Error(
      "Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY (server-only env var, never NEXT_PUBLIC_*)."
    );
  }
  if (!adminClient) {
    adminClient = createClient<Database>(appConfig.supabaseUrl, appConfig.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}
