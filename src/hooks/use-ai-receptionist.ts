import { useQuery } from "@tanstack/react-query";
import { getAIReceptionistStats } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useAIReceptionistStats() {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["ai-receptionist-stats"],
    queryFn: getAIReceptionistStats,
    refetchInterval: 30_000,
    enabled: hasHydrated,
  });
}
