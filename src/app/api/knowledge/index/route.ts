import { NextResponse } from "next/server";
import { knowledgeWebhookError, knowledgeWebhookUrls, postKnowledgeWebhook } from "@/lib/knowledge/n8n";
import { requireKnowledgeUser } from "@/lib/knowledge/require-user";

const COLUMNS = "id, organization_id, file_name, file_type, category, status, chunk_count, file_size_bytes, uploaded_by, error_message, created_at, updated_at";

export const maxDuration = 60;

function missingTable(message: string) {
  if (/documents|document_chunks|knowledge-documents/i.test(message)) {
    return "The knowledge base is not in this Supabase project yet. Run supabase/migrations/0005_knowledge_base.sql in the SQL editor, then try again.";
  }
  return message;
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireKnowledgeUser();
    const body = await request.json().catch(() => null);
    const documentId = typeof body?.document_id === "string" ? body.document_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
      return NextResponse.json({ error: "Choose a document to index." }, { status: 400 });
    }

    const existing = await supabase.from("documents").select(COLUMNS).eq("id", documentId).maybeSingle();
    if (existing.error) return NextResponse.json({ error: missingTable(existing.error.message) }, { status: 500 });
    if (!existing.data) return NextResponse.json({ error: "That document was not found." }, { status: 404 });

    const webhook = knowledgeWebhookUrls().index;
    if (!webhook) {
      await supabase.from("documents").update({ status: "failed", error_message: "Knowledge indexing is not configured." }).eq("id", documentId);
      return NextResponse.json(
        { error: "Knowledge indexing is not configured. Set N8N_KNOWLEDGE_INDEX_WEBHOOK_URL and activate the n8n workflow." },
        { status: 503 }
      );
    }

    let result: Awaited<ReturnType<typeof postKnowledgeWebhook>> | null = null;
    try {
      result = await postKnowledgeWebhook(webhook, { document_id: documentId });
    } catch {
      result = null;
    }

    if (result?.payload?.success !== true) {
      const message = result
        ? knowledgeWebhookError(result.status, result.payload, "n8n did not finish indexing this file.")
        : "n8n did not finish indexing this file.";
      await supabase.from("documents").update({ status: "failed", error_message: message }).eq("id", documentId).eq("status", "processing");
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const refreshed = await supabase.from("documents").select(COLUMNS).eq("id", documentId).maybeSingle();
    if (refreshed.error || !refreshed.data) {
      return NextResponse.json({ error: "The file was indexed, but the document row could not be reloaded." }, { status: 500 });
    }
    return NextResponse.json({ document: refreshed.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't index the document.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Sign in") ? 401 : 500 });
  }
}
