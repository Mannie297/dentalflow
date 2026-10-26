/**
 * Server-side Supabase client (anon key + the visitor's auth cookies).
 *
 * Use this inside Server Components, Server Actions, and Route Handlers.
 * A new client must be created per request (never cached as a module-level
 * singleton) because it carries the specific request's cookies.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appConfig, isSupabaseConfigured } from "@/lib/config";
import type { Database } from "./database.types";

export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use Live Mode."
    );
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` is called from a Server Component in some code paths (e.g. during a token
          // refresh triggered by a read). Server Components cannot set cookies -- this is safe to
          // ignore as long as a middleware is also refreshing the session (see src/middleware.ts).
        }
      },
    },
  });
}
