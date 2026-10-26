import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Megaphone,
  Phone,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import type { Permission } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { label: "Calls", href: "/calls", icon: Phone, permission: "calls.view" },
  { label: "Patients", href: "/patients", icon: Users, permission: "patients.view" },
  { label: "Appointments", href: "/appointments", icon: CalendarDays, permission: "appointments.view" },
  { label: "Leads", href: "/leads", icon: UsersRound, permission: "leads.view" },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone, permission: "campaigns.view" },
  { label: "AI Receptionist", href: "/ai-receptionist", icon: Bot, permission: "ai_receptionist.view" },
  { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, permission: "knowledge_base.view" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.view" },
  { label: "Reports", href: "/reports", icon: FileText, permission: "reports.view" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings.view" },
];
