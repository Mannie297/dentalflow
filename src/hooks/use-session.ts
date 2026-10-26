import { useQuery } from "@tanstack/react-query";
import { getCurrentSession } from "@/lib/services";
import { useUIStore, useHasHydrated } from "@/store/ui-store";

export function useSession() {
  const currentUserId = useUIStore((s) => s.currentUserId);
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["session", currentUserId],
    queryFn: () => getCurrentSession(currentUserId),
    staleTime: Infinity,
    enabled: hasHydrated,
  });
}
