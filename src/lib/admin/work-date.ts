import { shiftDateOnly, type DateOnly } from "@/lib/dates/format";
import { isArchivedTaskStatus, isOverdue } from "@/lib/admin/time";
import { isDoneTaskStatus, type Task } from "@/types/task";
import type { Meeting } from "@/types/meeting";

export const WEEK_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"] as const;

export type DayLoad = "empty" | "some" | "many" | "overdue" | "done";

export function workDate(task: Pick<Task, "scheduledDate" | "startDate" | "dueDate">) {
  return task.scheduledDate || task.startDate || task.dueDate;
}

export function weekStartSunday(date: DateOnly): DateOnly {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return shiftDateOnly(date, -utc.getUTCDay());
}

export function weekDays(anchor: DateOnly) {
  const start = weekStartSunday(anchor);
  return Array.from({ length: 7 }, (_, index) => shiftDateOnly(start, index));
}

export function monthDays(anchor: DateOnly) {
  const [year, month] = anchor.split("-").map(Number);
  const first = `${year}-${String(month).padStart(2, "0")}-01` as DateOnly;
  const nextMonth = (month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`) as DateOnly;
  const last = shiftDateOnly(nextMonth, -1);
  const start = weekStartSunday(first);
  const end = shiftDateOnly(weekStartSunday(last), 6);
  const days: DateOnly[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = shiftDateOnly(cursor, 1);
  }
  return { days, first, last, month, year };
}

export function shortDay(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function dayLoad(
  date: string,
  today: string,
  tasks: Task[],
  meetings: Meeting[],
): DayLoad {
  const dayTasks = tasks.filter((task) => workDate(task) === date);
  const dayMeetings = meetings.filter((item) => item.date === date && item.status !== "CANCELLED");
  if (dayTasks.some((task) => isOverdue(task, today))) return "overdue";
  if (!dayTasks.length && !dayMeetings.length) return "empty";
  const unfinished = dayTasks.filter((task) => !isDoneTaskStatus(task.status) && !isArchivedTaskStatus(task.status));
  if (dayTasks.length && !unfinished.length && !dayMeetings.length) return "done";
  return dayTasks.length + dayMeetings.length > 1 ? "many" : "some";
}
