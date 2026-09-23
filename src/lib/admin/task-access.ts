import { isEmployeeOnTask, taskParticipantIds } from "@/lib/admin/task-team";
import { actorCan, type ServerActor } from "@/lib/auth/server-actor";
import { isPendingApproval, isRejectedTaskStatus, type Task, type TaskStatus } from "@/types/task";

export { taskParticipantIds };

function manager(actor: ServerActor) {
  return actorCan(actor, "tasks.edit") || actor.isOwnerOrManager || actor.isSuperAdmin;
}

export function canSeeTaskDoc(
  actor: ServerActor,
  task: Pick<Task, "status" | "createdByUserId"> & Parameters<typeof isEmployeeOnTask>[0],
) {
  if (manager(actor)) return true;
  if (task.createdByUserId === actor.uid) return true;
  if (isPendingApproval(task.status as TaskStatus) || isRejectedTaskStatus(task.status as TaskStatus)) {
    return false;
  }
  return isEmployeeOnTask(task, actor.employeeId);
}

export function canAccessTaskChat(
  actor: ServerActor,
  task: Pick<Task, "createdByUserId"> & Parameters<typeof isEmployeeOnTask>[0],
) {
  if (manager(actor)) return true;
  if (task.createdByUserId === actor.uid) return true;
  return isEmployeeOnTask(task, actor.employeeId);
}

export function canChangeWorkStatus(
  actor: ServerActor,
  task: Pick<Task, "createdByUserId"> & Parameters<typeof isEmployeeOnTask>[0],
) {
  if (manager(actor)) return true;
  return isEmployeeOnTask(task, actor.employeeId);
}
