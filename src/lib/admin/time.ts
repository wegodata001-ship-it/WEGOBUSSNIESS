import { toTimestamp } from "@/lib/dates/timestamp";
import { isActiveTaskStatus, isArchivedTaskStatus, isDoneTaskStatus, isHiddenFromWorkMetrics, type Task } from "@/types/task";

export { isArchivedTaskStatus, isDoneTaskStatus, isActiveTaskStatus };
import type { WorkSession } from "@/types/work-hours";

export function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86400000);
}

export function elapsedLabel(startedAt: unknown) {
  const started = toTimestamp(startedAt);
  if (!started) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - started) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}:${String(rest).padStart(2, "0")}` : `${rest} דק׳`;
}

export function isOverdue(task: Task, today: string) {
  return Boolean(task.dueDate)
    && task.dueDate! < today
    && !isDoneTaskStatus(task.status)
    && !isArchivedTaskStatus(task.status)
    && !isHiddenFromWorkMetrics(task.status);
}

export function isUrgentTask(task: Task, today: string) {
  return task.priority === "URGENT" || task.priority === "HIGH" || isOverdue(task, today);
}

export function actualHoursForTask(sessions: WorkSession[], taskId: string) {
  const minutes = sessions
    .filter((session) => session.taskId === taskId)
    .reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
  return Math.round((minutes / 60) * 10) / 10;
}

export function openSessions(sessions: WorkSession[]) {
  return sessions.filter((session) => session.status === "OPEN");
}

export function taskIsActive(task: Task) {
  return isActiveTaskStatus(task.status);
}
