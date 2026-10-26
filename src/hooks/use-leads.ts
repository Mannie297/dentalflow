import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeadStatus } from "@/types";
import { getLead, getLeadFunnel, getLeads, updateLeadStatus, type LeadFilters } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useLeads(filters: LeadFilters = {}) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["leads", filters],
    queryFn: () => getLeads(filters),
    enabled: hasHydrated,
  });
}

export function useLead(id: string) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["lead", id],
    queryFn: () => getLead(id),
    enabled: hasHydrated && Boolean(id),
  });
}

export function useLeadFunnel(range: { from?: string; to?: string } = {}) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["lead-funnel", range],
    queryFn: () => getLeadFunnel(range),
    enabled: hasHydrated,
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) => updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-funnel"] });
    },
  });
}
