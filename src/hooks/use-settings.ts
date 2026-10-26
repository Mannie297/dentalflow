import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAIReceptionistSettings, getOrganization, getOrganizationUsers, saveReceptionistConfiguration, type AIReceptionistSettings, type ClinicProfileInput } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useOrganization() {
  const hasHydrated = useHasHydrated();
  return useQuery({ queryKey: ["organization"], queryFn: getOrganization, enabled: hasHydrated });
}

export function useOrganizationUsers() {
  const hasHydrated = useHasHydrated();
  return useQuery({ queryKey: ["organization-users"], queryFn: getOrganizationUsers, enabled: hasHydrated });
}

export function useAIReceptionistSettings() {
  const hasHydrated = useHasHydrated();
  return useQuery({ queryKey: ["ai-receptionist-settings"], queryFn: getAIReceptionistSettings, enabled: hasHydrated });
}

export function useSaveReceptionistConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { settings: AIReceptionistSettings; clinic: ClinicProfileInput }) => saveReceptionistConfiguration(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-receptionist-settings"] });
      queryClient.invalidateQueries({ queryKey: ["ai-receptionist-stats"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
  });
}
