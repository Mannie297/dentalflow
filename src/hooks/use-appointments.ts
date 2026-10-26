import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppointmentStatus } from "@/types";
import {
  type AppointmentFilters,
  type CreateAppointmentInput,
  createAppointment,
  getAppointments,
  getUpcomingAppointments,
  updateAppointmentStatus,
} from "@/lib/services";
import { useHasHydrated } from "@/store/ui-store";

export function useAppointments(filters: AppointmentFilters = {}) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["appointments", filters],
    queryFn: () => getAppointments(filters),
    enabled: hasHydrated,
  });
}

export function useUpcomingAppointments(limit = 6) {
  const hasHydrated = useHasHydrated();
  return useQuery({
    queryKey: ["upcoming-appointments", limit],
    queryFn: () => getUpcomingAppointments(limit),
    enabled: hasHydrated,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAppointmentInput) => createAppointment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      queryClient.invalidateQueries({ queryKey: ["call"] });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointmentStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-appointments"] });
    },
  });
}
