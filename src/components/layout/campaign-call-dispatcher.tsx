"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dispatchDueCampaignCalls } from "@/lib/services";
import { useHasHydrated, useUIStore } from "@/store/ui-store";

export function CampaignCallDispatcher() {
  const hydrated = useHasHydrated();
  const isDemoMode = useUIStore((state) => state.isDemoMode);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hydrated || isDemoMode) return;
    let stopped = false;

    const run = async () => {
      try {
        const result = await dispatchDueCampaignCalls();
        if (stopped || (result.placed < 1 && result.queued < 1)) return;
        if (result.placed > 0) {
          toast.success(result.placed === 1 ? "A scheduled call is being placed." : `${result.placed} scheduled calls are being placed.`);
        }
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        queryClient.invalidateQueries({ queryKey: ["scheduled-calls"] });
        queryClient.invalidateQueries({ queryKey: ["campaign"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      } catch {
        // The next pass retries a call that is still pending. A stuck claim is released after three minutes.
      }
    };

    void run();
    const timer = window.setInterval(() => void run(), 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [hydrated, isDemoMode, queryClient]);

  return null;
}
