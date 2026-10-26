import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  getCampaignPerformance,
  getCampaigns,
  previewAudience,
  updateCampaignStatus,
  cancelPendingScheduledCalls,
  getScheduledCalls,
  scheduleCampaignCalls,
  type AudiencePreset,
  type CreateCampaignInput,
} from "@/lib/services";
import type { CampaignStatus } from "@/types";
import { useHasHydrated } from "@/store/ui-store";

export function useCampaigns() {
  const hasHydrated = useHasHydrated();
  return useQuery({ queryKey: ["campaigns"], queryFn: getCampaigns, enabled: hasHydrated });
}

export function useCampaign(id: string) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => getCampaign(id),
    enabled: hasHydrated && Boolean(id),
  });
}

export function useCampaignPerformance() {
  const hasHydrated = useHasHydrated();
  return useQuery({ queryKey: ["campaign-performance"], queryFn: getCampaignPerformance, enabled: hasHydrated });
}

export function useAudiencePreview(preset: AudiencePreset | null) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["campaign-audience", preset],
    queryFn: () => previewAudience(preset as AudiencePreset),
    enabled: hasHydrated && Boolean(preset),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) => createCampaign(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-performance"] });
    },
  });
}

export function useUpdateCampaignStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CampaignStatus }) => updateCampaignStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-performance"] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-performance"] });
    },
  });
}

export function useScheduledCalls(campaignId: string) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["scheduled-calls", campaignId],
    queryFn: () => getScheduledCalls(campaignId),
    enabled: hasHydrated && Boolean(campaignId),
  });
}

export function useScheduleCampaignCalls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: scheduleCampaignCalls,
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-performance"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-calls", campaign.id] });
    },
  });
}

export function useCancelScheduledCalls(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelPendingScheduledCalls(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-calls", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
    },
  });
}
