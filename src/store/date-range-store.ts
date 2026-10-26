import { useMemo } from "react";
import { create } from "zustand";
import type { DateRangePreset } from "@/types";
import { resolveDateRange } from "@/lib/date-range";

interface DateRangeState {
  preset: DateRangePreset;
  customFrom: string | null;
  customTo: string | null;
  setPreset: (preset: DateRangePreset) => void;
  setCustomRange: (from: string, to: string) => void;
}

export const useDateRangeStore = create<DateRangeState>()((set) => ({
  preset: "last_30_days",
  customFrom: null,
  customTo: null,
  setPreset: (preset) => set({ preset }),
  setCustomRange: (from, to) => set({ preset: "custom", customFrom: from, customTo: to }),
}));

export function useResolvedDateRange() {
  const preset = useDateRangeStore((s) => s.preset);
  const customFrom = useDateRangeStore((s) => s.customFrom);
  const customTo = useDateRangeStore((s) => s.customTo);

  // Memoized so the resolved `to` boundary (which defaults to "now") stays stable across
  // re-renders instead of producing a new timestamp -- and therefore a new React Query key -- every render.
  return useMemo(
    () => resolveDateRange(preset, customFrom && customTo ? { from: customFrom, to: customTo } : undefined),
    [preset, customFrom, customTo]
  );
}
