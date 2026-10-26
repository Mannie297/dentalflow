import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentCategory } from "@/types";
import { deleteDocument, getDocumentChunks, getDocuments, reindexDocument, searchKnowledge, uploadDocument } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useDocuments(category?: DocumentCategory) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["documents", category ?? "all"],
    queryFn: () => getDocuments(category),
    enabled: hasHydrated,
  });
}

export function useDocumentChunks(documentId: string | null) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["document-chunks", documentId],
    queryFn: () => getDocumentChunks(documentId ?? ""),
    enabled: hasHydrated && Boolean(documentId),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; category: DocumentCategory }) => uploadDocument(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useReindexDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reindexDocument(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-chunks"] });
    },
  });
}

export function useSearchKnowledge() {
  return useMutation({
    mutationFn: (query: string) => searchKnowledge(query),
  });
}
