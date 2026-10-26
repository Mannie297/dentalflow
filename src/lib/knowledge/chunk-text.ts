// Keep this in step with the Chunk Text node in n8n/workflows/knowledge-index.json.
const DEFAULT_SIZE = 700;
const DEFAULT_OVERLAP = 80;
const MAX_CHUNKS = 120;

/** Split clinic document text into overlapping passages for embedding. */
export function chunkText(input: string, size = DEFAULT_SIZE, overlap = DEFAULT_OVERLAP): string[] {
  const text = input.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const lineBreak = text.lastIndexOf("\n", end);
      const space = text.lastIndexOf(" ", end);
      const breakAt = lineBreak > start + size * 0.5 ? lineBreak : space;
      if (breakAt > start + size * 0.5) end = breakAt;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
