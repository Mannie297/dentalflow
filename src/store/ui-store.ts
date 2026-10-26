import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CURRENT_USER_ID } from "@/lib/mock/current-user";

interface UIState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  currentUserId: string;
  isDemoMode: boolean;
  /**
   * Becomes `true` only once `persist.rehydrate()` has actually finished applying the
   * real localStorage value (see `skipHydration` note below, and `AppProviders`).
   *
   * WHY THIS EXISTS: every data-fetching hook in `src/hooks/*` ultimately calls a
   * service function that branches on `getCurrentDataSource()`, which reads
   * `isDemoMode` via `useUIStore.getState()`. React fires `useEffect`s
   * children-before-parents, so a deeply nested query's "fetch on mount" effect can
   * (and reliably does) run BEFORE `AppProviders`'s rehydration effect. Without this
   * flag, that first fetch silently reads the default `isDemoMode: true`, fetches mock
   * data, and -- because `isDemoMode` isn't part of any query key -- that wrong result
   * then sits in the React Query cache (within `staleTime`) even after rehydration
   * correctly flips `isDemoMode` to `false` moments later. The UI ends up showing
   * "Live Mode" with mock numbers and zero network requests to Supabase.
   *
   * Every `useQuery` whose `queryFn` depends on the active data source MUST include
   * `enabled: hasHydrated` (see `src/hooks/*`) so it simply doesn't fire until the
   * real persisted value is known.
   */
  hasHydrated: boolean;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setCurrentUserId: (id: string) => void;
  setDemoMode: (isDemo: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      currentUserId: DEFAULT_CURRENT_USER_ID,
      isDemoMode: true,
      hasHydrated: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      setCurrentUserId: (id) => set({ currentUserId: id }),
      setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "dentalflow-ui-store",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, currentUserId: s.currentUserId, isDemoMode: s.isDemoMode }),
      // Server-rendered HTML always uses the defaults above (no access to localStorage). Skipping
      // automatic hydration here -- and rehydrating manually post-mount in `AppProviders` -- keeps
      // the first client render identical to the server render so React doesn't report a hydration
      // mismatch whenever a visitor has a persisted value (e.g. a collapsed sidebar) from a prior visit.
      skipHydration: true,
    }
  )
);

/**
 * True once the store's real persisted value has been loaded from localStorage.
 * Any `useQuery` whose `queryFn` depends on the active data source (demo vs. live)
 * should pass `enabled: useHasHydrated()` (combined with its own `enabled` conditions,
 * if any) -- see the `hasHydrated` field doc comment above for why.
 */
export function useHasHydrated(): boolean {
  return useUIStore((s) => s.hasHydrated);
}
