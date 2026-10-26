import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CallIntakeInput } from "@/lib/call-intake/validation";
import { getCall, getCallTranscript, getCalls, placeOutboundCall, recordCall, type CallFilters, type PlaceOutboundCallInput } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useCalls(filters: CallFilters = {}) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["calls", filters],
    queryFn: () => getCalls(filters),
    enabled: hasHydrated,
  });
}

export function useCall(id: string) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["call", id],
    queryFn: () => getCall(id),
    enabled: hasHydrated && Boolean(id),
  });
}

export function useRecordCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CallIntakeInput) => recordCall(input),
    onSuccess: (result) => {
      if (!result.success) return;
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      queryClient.invalidateQueries({ queryKey: ["call"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}

export function usePlaceOutboundCall() {
  return useMutation({
    mutationFn: (input: PlaceOutboundCallInput) => placeOutboundCall(input),
  });
}

export function useCallTranscript(id: string) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["call-transcript", id],
    queryFn: () => getCallTranscript(id),
    enabled: hasHydrated && Boolean(id),
  });
}
