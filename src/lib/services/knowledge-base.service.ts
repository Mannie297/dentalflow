import type { DocumentCategory, DocumentFileType, KnowledgeDocument } from "@/types";
import { getMockDataset } from "@/lib/mock";
import { chunkText } from "@/lib/knowledge/chunk-text";
import { mapKnowledgeHits, type KnowledgeSearchHit, type KnowledgeSearchResult } from "@/lib/knowledge/hits";
import { getCurrentDataSource } from "@/lib/runtime-data-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type { KnowledgeSearchHit, KnowledgeSearchResult };

const LIST_COLUMNS = "id, organization_id, file_name, file_type, category, status, chunk_count, file_size_bytes, uploaded_by, error_message, created_at, updated_at";
const MAX_BYTES = 4 * 1024 * 1024;
const BUCKET = "knowledge-documents";

const demoText = new Map<string, string>();

function fileTypeFromName(fileName: string): DocumentFileType {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf" || extension === "docx" || extension === "txt" || extension === "csv") return extension;
  throw new Error("Upload a PDF, DOCX, TXT, or CSV file.");
}

function safeFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").replace(/^\.+/, "").slice(0, 120);
  return cleaned || "document";
}

function mapRow(row: {
  id: string;
  organization_id: string;
  file_name: string;
  file_type: string;
  category: string;
  status: string;
  chunk_count: number;
  file_size_bytes: number;
  uploaded_by: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}): KnowledgeDocument {
  return {
    id: row.id,
    organization_id: row.organization_id,
    file_name: row.file_name,
    file_type: row.file_type as DocumentFileType,
    category: row.category as DocumentCategory,
    status: row.status as KnowledgeDocument["status"],
    chunk_count: row.chunk_count,
    file_size_bytes: row.file_size_bytes,
    uploaded_by: row.uploaded_by ?? "",
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function missingTable(message: string): Error {
  if (/documents|document_chunks|match_document_chunks|knowledge-documents|Bucket not found|bucket/i.test(message)) {
    return new Error("The knowledge base is not in this Supabase project yet. Run supabase/migrations/0005_knowledge_base.sql in the SQL editor, then try again.");
  }
  return new Error(message);
}

async function clinicForUpload() {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload a document.");
  const { data: profile, error } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
  if (error || !profile) throw new Error("This account is not linked to a clinic.");
  return { supabase, userId: user.id, organizationId: profile.organization_id };
}

async function requestIndex(documentId: string): Promise<KnowledgeDocument> {
  const response = await fetch("/api/knowledge/index", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ document_id: documentId }),
  });
  const payload = (await response.json()) as { document?: Parameters<typeof mapRow>[0]; error?: string };
  if (!response.ok || !payload.document) throw new Error(payload.error ?? "Couldn't index the document.");
  return mapRow(payload.document);
}

export async function getDocuments(category?: DocumentCategory): Promise<KnowledgeDocument[]> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    let query = supabase.from("documents").select(LIST_COLUMNS).order("created_at", { ascending: false });
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw missingTable(error.message);
    return (data ?? []).map(mapRow);
  }
  const { documents } = getMockDataset();
  return category ? documents.filter((document) => document.category === category) : documents;
}

export async function getDocumentChunks(documentId: string): Promise<{ id: string; content: string; chunk_index: number }[]> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("document_chunks").select("id, content, chunk_index").eq("document_id", documentId).order("chunk_index", { ascending: true });
    if (error) throw missingTable(error.message);
    return data ?? [];
  }
  const text = demoText.get(documentId);
  if (!text) return [];
  return chunkText(text).map((content, chunk_index) => ({ id: `${documentId}-${chunk_index}`, content, chunk_index }));
}

export async function uploadDocument(input: { file: File; category: DocumentCategory }): Promise<KnowledgeDocument> {
  const fileType = fileTypeFromName(input.file.name);
  if (input.file.size <= 0) throw new Error("This file is empty.");
  if (input.file.size > MAX_BYTES) throw new Error("Upload a file up to 4 MB.");

  if (getCurrentDataSource() === "supabase") {
    const { supabase, userId, organizationId } = await clinicForUpload();
    const id = crypto.randomUUID();
    const storagePath = `${organizationId}/${id}/${safeFileName(input.file.name)}`;
    const uploaded = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
      upsert: false,
      contentType: input.file.type || undefined,
    });
    if (uploaded.error) throw missingTable(uploaded.error.message);

    const inserted = await supabase
      .from("documents")
      .insert({
        id,
        organization_id: organizationId,
        file_name: input.file.name,
        file_type: fileType,
        category: input.category,
        status: "processing",
        chunk_count: 0,
        file_size_bytes: input.file.size,
        uploaded_by: userId,
        storage_path: storagePath,
      })
      .select(LIST_COLUMNS)
      .single();
    if (inserted.error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw missingTable(inserted.error.message);
    }

    return requestIndex(id);
  }

  if (fileType === "pdf" || fileType === "docx") {
    throw new Error("Demo Mode can store text and CSV files. Switch to Live Mode so n8n can index PDF and Word files.");
  }
  const text = (await input.file.text()).trim();
  if (!text) throw new Error("This file has no text to index.");
  const { documents, organization } = getMockDataset();
  const now = new Date().toISOString();
  const document: KnowledgeDocument = {
    id: `doc-${Math.random().toString(36).slice(2, 9)}`,
    organization_id: organization.id,
    file_name: input.file.name,
    file_type: fileType,
    category: input.category,
    status: "indexed",
    chunk_count: chunkText(text).length,
    file_size_bytes: input.file.size,
    uploaded_by: "user-owner",
    created_at: now,
    updated_at: now,
  };
  demoText.set(document.id, text);
  documents.unshift(document);
  return document;
}

export async function deleteDocument(id: string): Promise<void> {
  if (getCurrentDataSource() === "supabase") {
    const supabase = getSupabaseBrowserClient();
    const existing = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
    if (existing.error) throw missingTable(existing.error.message);
    if (existing.data?.storage_path) {
      const removed = await supabase.storage.from(BUCKET).remove([existing.data.storage_path]);
      if (removed.error && !/not found/i.test(removed.error.message)) throw missingTable(removed.error.message);
    }
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw missingTable(error.message);
    return;
  }
  const { documents } = getMockDataset();
  const index = documents.findIndex((document) => document.id === id);
  if (index >= 0) documents.splice(index, 1);
  demoText.delete(id);
}

export async function reindexDocument(id: string): Promise<KnowledgeDocument | null> {
  if (getCurrentDataSource() === "supabase") {
    return requestIndex(id);
  }
  const document = getMockDataset().documents.find((item) => item.id === id) ?? null;
  if (!document) return null;
  document.status = "indexed";
  document.updated_at = new Date().toISOString();
  return document;
}

export async function searchKnowledge(query: string): Promise<KnowledgeSearchResult> {
  const text = query.trim();
  if (text.length < 3) throw new Error("Enter at least 3 characters to search.");
  if (getCurrentDataSource() === "supabase") {
    const response = await fetch("/api/knowledge/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: text }),
    });
    const payload = (await response.json()) as { answer?: unknown; hits?: unknown; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Couldn't search the knowledge base.");
    const hit = mapKnowledgeHits(payload.hits)[0] ?? null;
    const answer = typeof payload.answer === "string" ? payload.answer.trim() : hit?.content ?? "";
    return { answer, hit: answer ? hit : null };
  }

  const words = text.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  let bestHit: KnowledgeSearchHit | null = null;
  let bestScore = 0;
  for (const [documentId, source] of demoText) {
    const document = getMockDataset().documents.find((item) => item.id === documentId);
    if (!document) continue;
    const chunks = chunkText(source);
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const content = chunks[chunkIndex];
      const haystack = content.toLowerCase();
      const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      if (score <= bestScore) continue;
      bestScore = score;
      bestHit = {
        id: `${documentId}-${chunkIndex}`,
        document_id: documentId,
        file_name: document.file_name,
        category: document.category,
        content,
        chunk_index: chunkIndex,
        similarity: 1,
      };
    }
  }
  return { answer: bestHit?.content ?? "", hit: bestHit };
}
