import { taskParticipantIds } from "@/lib/admin/task-team";
import { canSeeTaskDoc } from "@/lib/admin/task-access";
import { actorCan, type ServerActor } from "@/lib/auth/server-actor";
import type { Employee } from "@/types/employee";
import type { Task } from "@/types/task";

/** Full employee directory (HR roster): managers/owners and employees.view only. */
export function canViewEmployeeDirectory(actor: ServerActor) {
  return actor.isSuperAdmin
    || actor.isOwnerOrManager
    || actorCan(actor, "employees.view")
    || actorCan(actor, "employees.manage");
}

/**
 * Employees an actor may receive from the records API.
 * Non-directory roles only get themselves plus people on tasks they can already see
 * (needed for assignee chips) — never the full roster via tasks.view alone.
 */
export function filterEmployeesForActor(
  actor: ServerActor,
  employees: Employee[],
  tasks: Array<Pick<Task, "status" | "createdByUserId"> & Parameters<typeof canSeeTaskDoc>[1]> = [],
) {
  if (canViewEmployeeDirectory(actor)) return employees;

  const allowed = new Set<string>();
  if (actor.employeeId) allowed.add(actor.employeeId);

  for (const task of tasks) {
    if (!canSeeTaskDoc(actor, task)) continue;
    for (const id of taskParticipantIds(task)) allowed.add(id);
  }

  return employees.filter((employee) => allowed.has(employee.id));
}

/** Sessions for non–viewAll actors: self only; empty if membership has no employeeId. */
export function filterSessionsForActor<T extends { employeeId: string }>(
  actor: ServerActor,
  sessions: T[],
  viewAll: boolean,
) {
  if (viewAll) return sessions;
  if (!actor.employeeId) return [];
  return sessions.filter((session) => session.employeeId === actor.employeeId);
}
