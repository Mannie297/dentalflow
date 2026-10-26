"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, Settings as SettingsIcon, Stethoscope } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav-config";
import { ROLE_LABELS } from "@/types";
import { useSession } from "@/hooks/use-session";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!session) return true;
    if (item.permission === "analytics.view") {
      return session.permissions.includes("analytics.view") || session.permissions.includes("analytics.limited");
    }
    return session.permissions.includes(item.permission);
  });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4", collapsed && "justify-center px-2")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Stethoscope className="h-4.5 w-4.5" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">DentalFlow AI</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">AI Front Desk Platform</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" aria-label="Main navigation">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const linkClassName = cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            isActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-2"
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={<Link href={item.href} onClick={onNavigate} aria-current={isActive ? "page" : undefined} className={linkClassName} />}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={linkClassName}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-2"
            )}
          >
            {collapsed ? <ChevronsRight className="h-4.5 w-4.5" aria-hidden="true" /> : <ChevronsLeft className="h-4.5 w-4.5" aria-hidden="true" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}

        <div className={cn("flex items-center gap-2.5 rounded-lg px-2 py-2", collapsed && "justify-center px-0")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {session ? getInitials(session.user.full_name) : "…"}
          </div>
          {!collapsed && session && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{session.user.full_name}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">{ROLE_LABELS[session.user.role]}</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="mt-1 flex items-center gap-1">
            <Link
              href="/settings"
              onClick={onNavigate}
              className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Settings
            </Link>
            <Link
              href="/logout"
              className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Logout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
