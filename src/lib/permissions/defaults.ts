import type { Permission } from "@/types/permissions";
import { PERMISSIONS } from "@/types/permissions";
import type { BusinessRole } from "@/types/roles";

export const ALL_BUSINESS_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const EMPLOYEE_PERMISSIONS: Permission[] = [
  "tasks.view",
  "tasks.start",
  "tasks.complete",
  "tasks.comment",
  "workHours.viewOwn",
  "logistics.create",
  "logistics.viewOwn",
  "meetings.view",
  "notifications.view",
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,
  "tasks.viewAll",
  "tasks.create",
  "tasks.edit",
  "tasks.delete",
  "employees.view",
  "employees.manage",
  "departments.view",
  "departments.manage",
  "projects.view",
  "projects.manage",
  "documents.view",
  "documents.manage",
  "bi.view",
  "meetings.view",
  "meetings.manage",
  "workHours.viewAll",
  "workHours.manage",
  "logistics.create",
  "logistics.viewOwn",
  "logistics.viewAll",
  "logistics.approve",
  "users.view",
  "activityLogs.view",
];

export const ROLE_PERMISSIONS: Record<BusinessRole, Permission[]> = {
  BUSINESS_OWNER: ALL_BUSINESS_PERMISSIONS,
  MANAGER: unique(MANAGER_PERMISSIONS),
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
};

function unique(items: Permission[]): Permission[] {
  return [...new Set(items)];
}
