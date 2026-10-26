# Knowledge base

DentalFlow stores the file. n8n does the reading, embedding, and search.

## Before the first upload

1. In the Supabase SQL editor, run `supabase/migrations/0005_knowledge_base.sql`. That creates the `documents` and `document_chunks` tables, the private `knowledge-documents` bucket, and `match_document_chunks`.
2. In n8n, import `n8n/workflows/knowledge-index.json` and `n8n/workflows/knowledge-search.json`.
3. Attach the **Supabase account** credential to every Supabase node and the **OpenAI** credential to **Embed Passages** and **Embed Question**.
4. Activate both workflows. Copy the production URLs into the server environment:
   - `N8N_KNOWLEDGE_INDEX_WEBHOOK_URL` = `https://mannie333.app.n8n.cloud/webhook/knowledge-index`
   - `N8N_KNOWLEDGE_SEARCH_WEBHOOK_URL` = `https://mannie333.app.n8n.cloud/webhook/knowledge-search`
5. Restart the Next.js server so it reads those variables. Do not prefix them with `NEXT_PUBLIC_`.

## Upload and re-index

Live Mode on `/knowledge-base` uploads the file into Supabase Storage and inserts a `documents` row with status Indexing. The app then sends `{ "document_id": "<uuid>" }` to the index webhook.

n8n loads that row, downloads `storage_path`, and reads the text:

- PDF goes through the Extract from File node.
- Word files are read from `word/document.xml`.
- Text and CSV are decoded as text.

Passages are about 700 characters, overlapping by 80, and capped at 120. Embeddings use `text-embedding-3-small`, which returns 1536 numbers. n8n replaces any older chunks, then sets the row to Indexed or Failed.

Re-index sends the same document id. The file already in Supabase is downloaded again.

A handled failure returns HTTP 200 with `{ "success": false, "error": "..." }`. The document row stores that message.

## Search

The search box sends the question to the app. The app adds the signed-in clinic's `organization_id` and posts `{ "query", "organization_id" }` to the search webhook. n8n embeds the question, loads the closest passages, and writes one answer with `gpt-4o-mini`. The answer may use only those passages. If a number in the answer is not in the chosen passage, the passage text is returned instead. If nothing is close enough, the answer is `The clinic documents do not say.`

```json
{ "success": true, "answer": "Give at least 48 hours' notice. Less notice may cost $75.", "hits": [{ "file_name": "maple-grove-patient-faq.pdf", "category": "faqs", "content": "...", "similarity": 0.72 }] }
```

Only passages from documents with status Indexed are used, and only for that clinic.
