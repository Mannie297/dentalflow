import type { DocumentCategory } from "@/types";

const CATEGORIES = new Set<DocumentCategory>([
  "clinic_policies",
  "services",
  "insurance",
  "pricing",
  "faqs",
  "emergency_procedures",
  "patient_instructions",
]);

export interface KnowledgeSearchResult {
  answer: string;
  hit: KnowledgeSearchHit | null;
}

export interface KnowledgeSearchHit {
  id: string;
  document_id: string;
  file_name: string;
  category: DocumentCategory;
  content: string;
  chunk_index: number;
  similarity: number;
}

export function mapKnowledgeHits(value: unknown): KnowledgeSearchHit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const category = row.category;
    if (typeof row.id !== "string" || typeof row.document_id !== "string" || typeof row.file_name !== "string") return [];
    if (typeof row.content !== "string" || typeof category !== "string" || !CATEGORIES.has(category as DocumentCategory)) return [];
    return [
      {
        id: row.id,
        document_id: row.document_id,
        file_name: row.file_name,
        category: category as DocumentCategory,
        content: row.content,
        chunk_index: Number(row.chunk_index) || 0,
        similarity: Number(row.similarity) || 0,
      },
    ];
  });
}
