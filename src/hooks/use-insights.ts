import { useQuery } from "@tanstack/react-query";
import { getAIInsights } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useAIInsights() {
  const hasHydrated = useHasHydrated();
  return useQuery({ queryKey: ["ai-insights"], queryFn: getAIInsights, enabled: hasHydrated });
}
