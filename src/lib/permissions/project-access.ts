import { hasAnyPermission, hasPermission } from "@/lib/permissions/engine";
import type { Permission } from "@/types/permissions";
import type { Project } from "@/types/department";
import { isEmployeeOnTask } from "@/lib/admin/task-team";
import { isPendingApproval, isRejectedTaskStatus, type Task, type TaskStatus } from "@/types/task";

export type ProjectAccessActor = {
  uid: string;
  employeeId: string | null;
  isOwnerOrManager?: boolean;
  isSuperAdmin?: boolean;
  permissions: readonly Permission[];
};

/** May call the projects list endpoint (possibly filtered). */
export function canListBusinessProjects(actor: {
  isSuperAdmin?: boolean;
  permissions: readonly Permission[];
}) {
  if (actor.isSuperAdmin) return true;
  return hasAnyPermission(actor.permissions, ["projects.view", "projects.manage", "tasks.create", "tasks.view"]);
}

/** Unrestricted project catalog (managers / owners / explicit projects.view). */
export function canViewAllBusinessProjects(actor: ProjectAccessActor) {
  if (actor.isSuperAdmin || actor.isOwnerOrManager) return true;
  return hasPermission(actor.permissions, "projects.view")
    || hasPermission(actor.permissions, "projects.manage");
}

function employeeCanUseTaskForProjectScope(
  actor: ProjectAccessActor,
  task: Pick<Task, "status" | "createdByUserId" | "projectId"> & Parameters<typeof isEmployeeOnTask>[0],
) {
  if (task.createdByUserId === actor.uid) return true;
  if (isPendingApproval(task.status as TaskStatus) || isRejectedTaskStatus(task.status as TaskStatus)) {
    return false;
  }
  return isEmployeeOnTask(task, actor.employeeId);
}

export function projectIdsForAssignedWork(
  actor: ProjectAccessActor,
  tasks: Array<Pick<Task, "status" | "createdByUserId" | "projectId"> & Parameters<typeof isEmployeeOnTask>[0]>,
) {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (!task.projectId) continue;
    if (!employeeCanUseTaskForProjectScope(actor, task)) continue;
    ids.add(task.projectId);
  }
  return ids;
}

export function filterProjectsForActor<T extends Pick<Project, "id">>(
  actor: ProjectAccessActor,
  projects: T[],
  tasks: Array<Pick<Task, "status" | "createdByUserId" | "projectId"> & Parameters<typeof isEmployeeOnTask>[0]>,
) {
  if (canViewAllBusinessProjects(actor)) return projects;
  const allowed = projectIdsForAssignedWork(actor, tasks);
  return projects.filter((project) => allowed.has(project.id));
}
