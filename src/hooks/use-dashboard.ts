import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "@/types";
import { getDashboardMetrics } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useDashboardMetrics(range: DateRange) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["dashboard-metrics", range.preset, range.from, range.to],
    queryFn: () => getDashboardMetrics(range),
    enabled: hasHydrated,
  });
}
