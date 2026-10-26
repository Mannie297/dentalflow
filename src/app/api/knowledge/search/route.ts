import { NextResponse } from "next/server";
import { mapKnowledgeHits, type KnowledgeSearchResult } from "@/lib/knowledge/hits";
import { knowledgeWebhookError, knowledgeWebhookUrls, postKnowledgeWebhook } from "@/lib/knowledge/n8n";
import { requireKnowledgeUser } from "@/lib/knowledge/require-user";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireKnowledgeUser();
    const body = await request.json().catch(() => null);
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (query.length < 3) return NextResponse.json({ error: "Enter at least 3 characters to search." }, { status: 400 });
    if (query.length > 500) return NextResponse.json({ error: "Enter a shorter question." }, { status: 400 });

    const profile = await supabase.from("profiles").select("organization_id").eq("id", userId).single();
    if (profile.error || !profile.data) return NextResponse.json({ error: "This account is not linked to a clinic." }, { status: 403 });

    const webhook = knowledgeWebhookUrls().search;
    if (!webhook) {
      return NextResponse.json(
        { error: "Knowledge search is not configured. Set N8N_KNOWLEDGE_SEARCH_WEBHOOK_URL and activate the n8n workflow." },
        { status: 503 }
      );
    }

    let result: Awaited<ReturnType<typeof postKnowledgeWebhook>> | null = null;
    try {
      result = await postKnowledgeWebhook(webhook, { query, organization_id: profile.data.organization_id });
    } catch {
      result = null;
    }

    if (result?.payload?.success !== true) {
      const message = result
        ? knowledgeWebhookError(result.status, result.payload, "Couldn't search the knowledge base.")
        : "Couldn't search the knowledge base.";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const hits = mapKnowledgeHits(result.payload.hits).slice(0, 1);
    const written = typeof result.payload.answer === "string" ? result.payload.answer.trim() : "";
    const hit = hits[0] ?? null;
    const answer = written || hit?.content || "";
    const searchResult: KnowledgeSearchResult = { answer, hit: answer ? hit : null };
    return NextResponse.json(searchResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't search the knowledge base.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 500 });
  }
}
