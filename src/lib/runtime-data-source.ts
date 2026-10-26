/**
 * Bridges the Zustand UI store (React state) into the plain async service
 * layer (`src/lib/services/*.service.ts`), which are ordinary functions and
 * can't call React hooks. Reading `useUIStore.getState()` outside of a React
 * render is a supported Zustand pattern and always reflects the latest value.
 *
 * This is the ONLY place a `*.service.ts` file should resolve "am I in Demo
 * Mode or Live Mode right now" -- see `getActiveDataSource()` in `config.ts`
 * for the full precedence rules.
 */
import { getActiveDataSource, type DataSource } from "@/lib/config";
import { useUIStore } from "@/store/ui-store";

export function getCurrentDataSource(): DataSource {
  return getActiveDataSource(useUIStore.getState().isDemoMode);
}
