import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock3,
  FileArchive,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/types";
import type { Permission } from "@/types/permissions";

export type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  permission?: Permission;
  superAdminOnly?: boolean;
};

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/today", labelKey: "nav.today", icon: CalendarDays, permission: "tasks.view" },
  { href: "/tasks", labelKey: "nav.tasks", icon: ClipboardList, permission: "tasks.view" },
  { href: "/bi", labelKey: "nav.bi", icon: BarChart3, permission: "bi.view" },
  { href: "/projects", labelKey: "nav.projects", icon: FolderKanban, permission: "projects.view" },
  { href: "/documents", labelKey: "nav.documents", icon: FileArchive, permission: "documents.view" },
  { href: "/work-hours", labelKey: "nav.hours", icon: Clock3, permission: "workHours.viewOwn" },
  { href: "/meetings", labelKey: "nav.meetings", icon: CalendarRange, permission: "meetings.view" },
  { href: "/requests", labelKey: "nav.requests", icon: Truck, permission: "logistics.create" },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, permission: "settings.manage" },
];

export const MANAGEMENT_NAV: NavItem[] = [];

export const PLATFORM_NAV: NavItem[] = [
  { href: "/admin/businesses", labelKey: "nav.adminBusinesses", icon: Building2, superAdminOnly: true },
  { href: "/admin/users", labelKey: "nav.adminUsers", icon: Users, superAdminOnly: true },
];

export const UTILITY_NAV: NavItem[] = [];

export const APP_ROUTES = [
  "/login",
  "/dashboard",
  "/today",
  "/work-board",
  "/tasks",
  "/bi",
  "/projects",
  "/documents",
  "/employees",
  "/work-hours",
  "/meetings",
  "/requests",
  "/notifications",
  "/settings",
  "/admin/businesses",
  "/admin/users",
] as const;
