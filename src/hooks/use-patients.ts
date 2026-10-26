import { useQuery } from "@tanstack/react-query";
import { getPatient, getPatients, type PatientFilters } from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function usePatients(filters: PatientFilters = {}) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["patients", filters],
    queryFn: () => getPatients(filters),
    enabled: hasHydrated,
  });
}

export function usePatient(id: string) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => getPatient(id),
    enabled: hasHydrated && Boolean(id),
  });
}
