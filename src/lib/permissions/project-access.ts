import { hasAnyPermission } from "@/lib/permissions/engine";
import type { Permission } from "@/types/permissions";

export function canListBusinessProjects(actor: {
  isSuperAdmin?: boolean;
  permissions: readonly Permission[];
}) {
  if (actor.isSuperAdmin) return true;
  return hasAnyPermission(actor.permissions, ["projects.view", "tasks.create", "tasks.view"]);
}
