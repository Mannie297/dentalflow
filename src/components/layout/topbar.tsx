"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Search, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { MobileNav } from "./mobile-nav";
import { useSession } from "@/hooks/use-session";
import { getInitials } from "@/lib/format";
import { ROLE_LABELS, USER_ROLES } from "@/types";
import { useUIStore } from "@/store/ui-store";
import { DEMO_USERS } from "@/lib/mock/current-user";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

export function Topbar() {
  const { data: session } = useSession();
  const currentUserId = useUIStore((s) => s.currentUserId);
  const setCurrentUserId = useUIStore((s) => s.setCurrentUserId);
  const isDemoMode = useUIStore((s) => s.isDemoMode);
  const setDemoMode = useUIStore((s) => s.setDemoMode);
  const queryClient = useQueryClient();
  const router = useRouter();
  const supabaseReady = isSupabaseConfigured();

  async function handleToggleMode() {
    if (isDemoMode) {
      // Switching Demo -> Live requires a Supabase session (RLS has nothing to match otherwise).
      if (!supabaseReady) {
        toast.error("Supabase isn't configured for this deployment yet.", {
          description: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY -- see /docs/DEPLOYMENT.md.",
        });
        return;
      }
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setDemoMode(false);
      // Note: `queryClient.clear()` only destroys/removes cached Query objects -- it
      // does NOT refetch or notify any currently-mounted `useQuery` observers (e.g. the
      // dashboard, calls, leads pages). Since those pages don't themselves subscribe to
      // `isDemoMode`, nothing would make them re-render to pick up the mode change, so
      // they'd keep showing their last-rendered (now-orphaned) result until something
      // else happened to force a re-render -- which is why a manual page refresh was
      // needed before. `invalidateQueries()` instead calls `query.fetch()` directly on
      // every active query and notifies its observers, forcing an immediate, visible
      // refetch with no reload required.
      queryClient.invalidateQueries();
      toast.success("Live Mode enabled. Data now comes from Supabase.");
    } else {
      setDemoMode(true);
      queryClient.invalidateQueries();
      toast.info("Demo Mode enabled. Showing sample data.");
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6">
      <MobileNav />

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{session?.organization.name ?? "DentalFlow AI"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {session?.organization.city}, {session?.organization.province}
        </p>
      </div>

      <div className="ml-2 hidden max-w-sm flex-1 items-center sm:flex">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search patients, calls, appointments…"
            className="pl-9"
            aria-label="Global search"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden md:block">
          <DateRangePicker />
        </div>

        <button
          type="button"
          onClick={handleToggleMode}
          className="hidden lg:flex"
          aria-label={isDemoMode ? "Switch to Live Mode" : "Switch to Demo Mode"}
          title={
            isDemoMode
              ? supabaseReady
                ? "Showing sample data. Click to switch to Live Mode (Supabase)."
                : "Showing sample data. Supabase isn't configured yet."
              : "Connected to Supabase. Click to switch back to Demo Mode."
          }
        >
          <Badge variant="secondary" className="gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${isDemoMode ? "bg-success" : "bg-info"}`} />
            {isDemoMode ? "Demo Mode" : "Live Mode"}
          </Badge>
        </button>

        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4.5 w-4.5" aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="User menu"
          >
            {session ? getInitials(session.user.full_name) : <UserIcon className="h-4 w-4" aria-hidden="true" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* Base UI's Menu.GroupLabel (unlike Radix's DropdownMenu.Label) throws
                "MenuGroupContext is missing" unless it's rendered inside <Menu.Group> --
                so every DropdownMenuLabel here must be wrapped in a DropdownMenuGroup. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="font-medium text-foreground">{session?.user.full_name}</p>
                <p className="font-normal text-muted-foreground">{session ? ROLE_LABELS[session.user.role] : ""}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Demo: view as role</DropdownMenuLabel>
              {DEMO_USERS.filter((u) => USER_ROLES.includes(u.role)).map((u) => (
                <DropdownMenuItem key={u.id} onClick={() => setCurrentUserId(u.id)} className="justify-between">
                  <span>{u.full_name}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role]}</span>
                  {currentUserId === u.id ? <span className="h-1.5 w-1.5 rounded-full bg-success" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <SettingsIcon className="h-4 w-4" aria-hidden="true" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" render={<Link href="/logout" />}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
