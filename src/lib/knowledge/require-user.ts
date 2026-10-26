import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireKnowledgeUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sign in to use the knowledge base.");
  }
  return { supabase, userId: data.user.id };
}
