"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDeleteDocument, useDocumentChunks, useDocuments, useReindexDocument, useSearchKnowledge, useUploadDocument } from "@/hooks/use-knowledge-base";
import type { KnowledgeSearchResult } from "@/lib/services";
import type { DocumentCategory } from "@/types";
import { DOCUMENT_CATEGORY_LABELS } from "@/types";
import { DOCUMENT_STATUS_TONE } from "@/lib/status-map";
import { formatDate } from "@/lib/format";
import { PageHeader, SectionCard } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen } from "lucide-react";

const STATUS_LABELS = { processing: "Indexing", indexed: "Indexed", failed: "Failed" } as const;

export default function KnowledgeBasePage() {
  const [category, setCategory] = useState<DocumentCategory | "all">("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("faqs");
  const [file, setFile] = useState<File | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<KnowledgeSearchResult | null>(null);

  const documents = useDocuments(category === "all" ? undefined : category);
  const chunks = useDocumentChunks(viewId);
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const reindex = useReindexDocument();
  const search = useSearchKnowledge();
  const viewing = documents.data?.find((document) => document.id === viewId) ?? null;
  const deleting = documents.data?.find((document) => document.id === deleteId) ?? null;

  function handleUpload() {
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    upload.mutate(
      { file, category: uploadCategory },
      {
        onSuccess: (document) => {
          toast.success(`${document.file_name} is indexed.`, { description: `${document.chunk_count} passages are searchable.` });
          setUploadOpen(false);
          setFile(null);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't index the document."),
      }
    );
  }

  function handleSearch() {
    search.mutate(query, {
      onSuccess: (next) => setResult(next),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't search the knowledge base."),
    });
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Knowledge base"
        description="Clinic files are hosted in Supabase. n8n reads each file, builds the search index, and answers questions."
        actions={<Button onClick={() => setUploadOpen(true)}>Upload</Button>}
      />

      <SectionCard title="Search" description="Ask a clinic question. n8n returns one answer from the closest passage in the stored documents.">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What is the cancellation policy?" aria-label="Search the knowledge base" />
          <Button type="submit" disabled={search.isPending}>
            {search.isPending ? "Searching…" : "Search"}
          </Button>
        </form>
        {result && !result.answer ? <p className="mt-4 text-sm text-muted-foreground">The clinic documents do not say.</p> : null}
        {result?.answer ? (
          <div className="mt-4 rounded-lg border border-border p-3">
            <p className="text-sm text-foreground">{result.answer}</p>
            {result.hit ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {result.hit.file_name} · {DOCUMENT_CATEGORY_LABELS[result.hit.category]}
              </p>
            ) : null}
          </div>
        ) : null}
      </SectionCard>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <select
          aria-label="Filter by category"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:w-56"
          value={category}
          onChange={(event) => setCategory(event.target.value as DocumentCategory | "all")}
        >
          <option value="all">All categories</option>
          {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {documents.isError ? (
        <ErrorState title="Couldn't load documents" description={documents.error instanceof Error ? documents.error.message : "Something went wrong."} onRetry={() => documents.refetch()} />
      ) : documents.isLoading || !documents.data ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : documents.data.length === 0 ? (
        <EmptyState icon={BookOpen} title="No documents yet." description="Upload a PDF, Word, text, or CSV file. The file is saved in Supabase, and n8n indexes it for search." />
      ) : (
        <SectionCard contentClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Chunks</TableHead>
                <TableHead className="text-right">Indexed</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.data.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="max-w-56 font-medium">
                    <span className="block truncate">{document.file_name}</span>
                    {document.error_message ? <span className="block truncate text-xs text-destructive">{document.error_message}</span> : null}
                  </TableCell>
                  <TableCell>{DOCUMENT_CATEGORY_LABELS[document.category]}</TableCell>
                  <TableCell>{formatDate(document.created_at, { month: "short", day: "numeric", year: "numeric" })}</TableCell>
                  <TableCell>
                    <StatusBadge tone={DOCUMENT_STATUS_TONE[document.status]} label={STATUS_LABELS[document.status]} />
                  </TableCell>
                  <TableCell className="text-right">{document.chunk_count}</TableCell>
                  <TableCell className="text-right">{document.status === "indexed" ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setViewId(document.id)}>
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={reindex.isPending}
                        onClick={() =>
                          reindex.mutate(document.id, {
                            onSuccess: () => toast.success(`${document.file_name} was re-indexed.`),
                            onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't re-index."),
                          })
                        }
                      >
                        Re-index
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(document.id)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload a document</DialogTitle>
            <DialogDescription>The file is saved in Supabase. n8n reads it and stores searchable passages. Indexing can take a minute.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="knowledge-category">Category</Label>
              <select
                id="knowledge-category"
                className="mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={uploadCategory}
                onChange={(event) => setUploadCategory(event.target.value as DocumentCategory)}
              >
                {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="knowledge-file">File</Label>
              <Input
                id="knowledge-file"
                className="mt-1.5"
                type="file"
                accept=".pdf,.docx,.txt,.csv,application/pdf,text/plain,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={upload.isPending}>
              {upload.isPending ? "Indexing…" : "Upload and index"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewId)} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.file_name ?? "Document"}</DialogTitle>
            <DialogDescription>{viewing ? DOCUMENT_CATEGORY_LABELS[viewing.category] : "Indexed passages"}</DialogDescription>
          </DialogHeader>
          {chunks.isLoading ? <p className="text-sm text-muted-foreground">Loading passages…</p> : null}
          {chunks.data && chunks.data.length === 0 ? <p className="text-sm text-muted-foreground">No passages are stored for this document.</p> : null}
          <ol className="space-y-3">
            {(chunks.data ?? []).map((chunk) => (
              <li key={chunk.id} className="text-sm text-foreground">
                <span className="text-xs text-muted-foreground">Passage {chunk.chunk_index + 1}</span>
                <p className="mt-1 whitespace-pre-wrap">{chunk.content}</p>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.file_name ?? "this document"}?</DialogTitle>
            <DialogDescription>This removes the file and its searchable passages from Supabase.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (!deleteId) return;
                remove.mutate(deleteId, {
                  onSuccess: () => {
                    toast.success("Document deleted.");
                    setDeleteId(null);
                    if (viewId === deleteId) setViewId(null);
                  },
                  onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't delete the document."),
                });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
