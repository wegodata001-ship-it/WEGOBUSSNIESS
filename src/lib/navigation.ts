import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarRange,
  ClipboardList,
  Clock3,
  Coins,
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

export type NavGroup = {
  id: string;
  labelKey: MessageKey;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    labelKey: "nav.main",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
    ],
  },
  {
    id: "work",
    labelKey: "nav.work",
    items: [
      { href: "/tasks", labelKey: "nav.tasks", icon: ClipboardList, permission: "tasks.view" },
      { href: "/projects", labelKey: "nav.projects", icon: FolderKanban, permission: "projects.view" },
      { href: "/meetings", labelKey: "nav.meetings", icon: CalendarRange, permission: "meetings.view" },
    ],
  },
  {
    id: "management",
    labelKey: "nav.management",
    items: [
      { href: "/employees", labelKey: "nav.employees", icon: Users, permission: "employees.view" },
      { href: "/attendance", labelKey: "nav.attendance", icon: Clock3, permission: "workHours.viewOwn" },
      { href: "/work-hours", labelKey: "nav.hours", icon: Clock3, permission: "workHours.viewOwn" },
      { href: "/requests", labelKey: "nav.requests", icon: Truck, permission: "logistics.create" },
      { href: "/movements", labelKey: "nav.movements", icon: Coins, permission: "finance.view" },
    ],
  },
  {
    id: "info",
    labelKey: "nav.info",
    items: [
      { href: "/documents", labelKey: "nav.documents", icon: FileArchive, permission: "documents.view" },
      { href: "/bi", labelKey: "nav.bi", icon: BarChart3, permission: "bi.view" },
    ],
  },
  {
    id: "system",
    labelKey: "nav.system",
    items: [
      { href: "/settings", labelKey: "nav.settings", icon: Settings, permission: "employees.manage" },
    ],
  },
];

export const MAIN_NAV: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

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
  "/clients",
  "/sign",
  "/employees",
  "/attendance",
  "/work-hours",
  "/meetings",
  "/requests",
  "/movements",
  "/notifications",
  "/settings",
  "/admin/businesses",
  "/admin/users",
] as const;
