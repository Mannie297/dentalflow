"use client";

import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useUIStore } from "@/store/ui-store";
import { QueryProvider } from "./query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  // See `skipHydration` note in `ui-store.ts` -- rehydrate from localStorage only after the first
  // client render/commit so it can never diverge from the server-rendered HTML.
  //
  // `rehydrate()` resolves once the real persisted state has actually been applied to the
  // store. Only then do we flip `hasHydrated`, which every data-source-dependent query is
  // gated on (`enabled: useHasHydrated()`) -- this closes the race where a child query's
  // mount effect fires before this effect and reads the stale `isDemoMode` default.
  useEffect(() => {
    Promise.resolve(useUIStore.persist.rehydrate()).then(() => {
      useUIStore.getState().setHasHydrated(true);
    });
  }, []);

  return (
    <QueryProvider>
      <TooltipProvider delay={200}>
        {children}
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </QueryProvider>
  );
}
