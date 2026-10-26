"use client";

/**
 * Browser-side Supabase client (anon key only -- safe to ship to the client).
 *
 * This is a singleton: call `getSupabaseBrowserClient()` from client
 * components/hooks instead of constructing a new client per call.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appConfig, isSupabaseConfigured } from "@/lib/config";
import type { Database } from "./database.types";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use Live Mode."
    );
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
  }
  return browserClient;
}
