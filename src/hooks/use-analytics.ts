import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DateRange } from "@/types";
import { getAnalyticsOverview, type AnalyticsFilters } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useAnalyticsOverview(range: DateRange, filters: AnalyticsFilters = {}) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["analytics-overview", range.from, range.to, filters.service ?? "all", filters.source ?? "all", filters.campaignId ?? "all", filters.dentist ?? "all"],
    queryFn: () => getAnalyticsOverview(range, filters),
    enabled: hasHydrated,
    placeholderData: keepPreviousData,
  });
}
