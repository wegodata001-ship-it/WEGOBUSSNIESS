import { isAttendanceSession } from "@/lib/admin/attendance";
import { meetingParticipants } from "@/lib/admin/meeting-time";
import { isOverdue, taskIsActive } from "@/lib/admin/time";
import { shiftDateOnly } from "@/lib/dates/format";
import type { BusinessCatalog } from "@/lib/admin/catalog";
import type { Employee } from "@/types/employee";
import type { Meeting } from "@/types/meeting";
import type { Task } from "@/types/task";

export type ScheduleKind = "task" | "meeting" | "deadline" | "attendance" | "request";
export type ScheduleRange = "today" | "tomorrow" | "week";

export type ScheduleItem = {
  id: string;
  kind: ScheduleKind;
  date: string;
  time: string;
  endTime: string | null;
  title: string;
  people: string;
  peopleIds: string[];
  location: string | null;
  href: string;
  meeting: Meeting | null;
  task: Task | null;
};

export const SCHEDULE_TONE: Record<ScheduleKind, { dot: string; border: string; badge: string; icon: string }> = {
  task: { dot: "bg-blue-500", border: "border-s-blue-500", badge: "bg-blue-50 text-blue-700", icon: "text-blue-600" },
  meeting: { dot: "bg-violet-500", border: "border-s-violet-500", badge: "bg-violet-50 text-violet-700", icon: "text-violet-600" },
  deadline: { dot: "bg-red-500", border: "border-s-red-500", badge: "bg-red-50 text-red-700", icon: "text-red-600" },
  attendance: { dot: "bg-emerald-500", border: "border-s-emerald-500", badge: "bg-emerald-50 text-emerald-700", icon: "text-emerald-600" },
  request: { dot: "bg-amber-400", border: "border-s-amber-400", badge: "bg-amber-50 text-amber-700", icon: "text-amber-600" },
};

function weekBounds(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const from = shiftDateOnly(today, -utc.getUTCDay());
  return { from, to: shiftDateOnly(from, 6) };
}

export function rangeBounds(range: ScheduleRange, today: string) {
  if (range === "tomorrow") {
    const tomorrow = shiftDateOnly(today, 1);
    return { from: tomorrow, to: tomorrow };
  }
  if (range === "week") return weekBounds(today);
  return { from: today, to: today };
}

function nameOf(employees: Employee[], id: string | null | undefined) {
  if (!id) return "";
  return employees.find((item) => item.id === id)?.displayName ?? "";
}

function names(employees: Employee[], ids: string[]) {
  return ids.map((id) => nameOf(employees, id)).filter(Boolean).join(", ");
}

export function buildSchedule(
  data: BusinessCatalog,
  today: string,
  range: ScheduleRange = "today",
  employeeId?: string | null,
): ScheduleItem[] {
  const { from, to } = rangeBounds(range, today);
  const inRange = (date: string | null | undefined) => Boolean(date) && date! >= from && date! <= to;
  const items: ScheduleItem[] = [];

  for (const session of data.sessions.filter((item) => inRange(item.date) && item.startTime && isAttendanceSession(item))) {
    if (employeeId && session.employeeId !== employeeId) continue;
    items.push({
      id: `attendance-${session.id}`,
      kind: "attendance",
      date: session.date,
      time: session.startTime,
      endTime: session.endTime,
      title: session.status === "OPEN" ? "כניסה לעבודה" : "יום עבודה",
      people: nameOf(data.employees, session.employeeId),
      peopleIds: session.employeeId ? [session.employeeId] : [],
      location: null,
      href: "/attendance",
      meeting: null,
      task: null,
    });
  }

  for (const meeting of data.meetings.filter((item) => inRange(item.date) && item.status !== "CANCELLED")) {
    const peopleIds = meetingParticipants(meeting);
    if (employeeId && !peopleIds.includes(employeeId)) continue;
    items.push({
      id: `meeting-${meeting.id}`,
      kind: "meeting",
      date: meeting.date,
      time: meeting.startTime || "00:00",
      endTime: meeting.endTime,
      title: meeting.title,
      people: names(data.employees, peopleIds),
      peopleIds,
      location: meeting.location,
      href: "/meetings",
      meeting,
      task: null,
    });
  }

  for (const task of data.tasks.filter((task) => taskIsActive(task) && (inRange(task.scheduledDate) || inRange(task.startDate)))) {
    const peopleIds = [task.assigneeId, ...task.collaboratorIds].filter((id): id is string => Boolean(id));
    if (employeeId && !peopleIds.includes(employeeId)) continue;
    const date = task.scheduledDate || task.startDate || task.dueDate || today;
    items.push({
      id: `task-${task.id}`,
      kind: "task",
      date,
      time: task.startTime || "09:00",
      endTime: task.endTime,
      title: task.title,
      people: names(data.employees, peopleIds),
      peopleIds,
      location: null,
      href: "/tasks",
      meeting: null,
      task,
    });
  }

  for (const task of data.tasks.filter((task) => inRange(task.dueDate) && (taskIsActive(task) || isOverdue(task, today)))) {
    const peopleIds = [task.assigneeId, ...task.collaboratorIds].filter((id): id is string => Boolean(id));
    if (employeeId && !peopleIds.includes(employeeId)) continue;
    const already = items.some((item) => item.task?.id === task.id);
    if (already && task.scheduledDate === task.dueDate) continue;
    items.push({
      id: `deadline-${task.id}`,
      kind: "deadline",
      date: task.dueDate!,
      time: task.endTime || task.startTime || "17:00",
      endTime: task.endTime,
      title: task.title,
      people: names(data.employees, peopleIds),
      peopleIds,
      location: null,
      href: "/tasks?filter=dueToday",
      meeting: null,
      task,
    });
  }

  for (const request of data.requests.filter((item) => inRange(item.requestDate) && (item.status === "PENDING" || item.status === "NEED_INFO"))) {
    if (employeeId && request.requestedByEmployeeId !== employeeId) continue;
    const created = request.createdAt;
    const time = created
      ? `${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}`
      : "12:00";
    items.push({
      id: `request-${request.id}`,
      kind: "request",
      date: request.requestDate || today,
      time,
      endTime: null,
      title: request.title,
      people: nameOf(data.employees, request.requestedByEmployeeId),
      peopleIds: request.requestedByEmployeeId ? [request.requestedByEmployeeId] : [],
      location: null,
      href: "/requests",
      meeting: null,
      task: null,
    });
  }

  return items.sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
}
