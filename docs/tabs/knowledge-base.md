# Knowledge Base

Route: `/knowledge-base`

Clinic files are hosted in Supabase. n8n reads each file, splits it into passages, stores the vectors, and answers search questions. DentalFlow does not parse PDFs or run an embedding model.

## What you can do

- Upload a PDF, DOCX, TXT, or CSV file, up to 4 MB, and choose a category.
- See each document's category, upload date, status, chunk count, and whether it is indexed.
- View the stored passages.
- Re-index a document. n8n downloads the file from Supabase again and replaces the passages.
- Delete a document, its passages, and the stored file.
- Search with a question. n8n returns one answer taken from the closest passage, with the document name.

Demo Mode can index text and CSV files in memory with a keyword match. PDF and Word files, and vector search, run in Live Mode.

## How the code works

The page is `src/app/(app)/knowledge-base/page.tsx`. The browser service is `src/lib/services/knowledge-base.service.ts`.

Live upload:

1. The browser inserts a `documents` row and uploads the file to the private `knowledge-documents` bucket at `{organization_id}/{document_id}/{file_name}`.
2. The browser calls `POST /api/knowledge/index` with the document id. That route checks the signed-in user, then posts the id to n8n.
3. n8n workflow **Knowledge — Index Document** downloads the file with the Supabase credential, reads the text, chunks it, calls OpenAI `text-embedding-3-small` (1536 numbers), writes `document_chunks`, and sets the document to indexed or failed.

Search posts the question to `POST /api/knowledge/search`. The route adds the signed-in clinic id and calls n8n workflow **Knowledge — Search**. That workflow embeds the question and calls `match_document_chunks` in `supabase/migrations/0005_knowledge_base.sql`. It keeps the closest passages for that clinic, then asks OpenAI for one answer that uses only those passages. A fee, time, or phone number that is not in the chosen passage is discarded, and the passage text is shown instead.

The webhook URLs are server-only: `N8N_KNOWLEDGE_INDEX_WEBHOOK_URL` and `N8N_KNOWLEDGE_SEARCH_WEBHOOK_URL`.

The migration has to be applied in the Supabase SQL editor before Live Mode can list, upload, or search. Import and activate both n8n workflows, and attach the existing Supabase and OpenAI credentials, before indexing will finish.
