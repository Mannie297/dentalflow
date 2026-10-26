/**
 * Server-only n8n webhooks for the knowledge base.
 * The browser uploads files to Supabase and calls the app routes.
 * These URLs stay on the server.
 */

export function knowledgeWebhookUrls() {
  return {
    index: process.env.N8N_KNOWLEDGE_INDEX_WEBHOOK_URL?.trim() ?? "",
    search: process.env.N8N_KNOWLEDGE_SEARCH_WEBHOOK_URL?.trim() ?? "",
  };
}

export async function postKnowledgeWebhook(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
}

export function knowledgeWebhookError(status: number, payload: Record<string, unknown> | null, fallback: string) {
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error.trim();
  if (status === 404) return "That n8n workflow is not active. Activate it and use the production webhook URL.";
  return fallback;
}
