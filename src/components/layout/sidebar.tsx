"use client";

import { useUIStore } from "@/store/ui-store";
import { SidebarContent } from "./sidebar-content";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={toggleSidebar} />
    </aside>
  );
}
