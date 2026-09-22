import { addMinutesToTime, durationMinutes } from "@/lib/admin/meeting-time";
import { asCalendarColor, type CalendarColor } from "@/lib/admin/palette";
import { isEmployeeOnTask } from "@/lib/admin/task-team";
import { isDateOnly, isTimeOnly } from "@/lib/dates/format";
import { meetingParticipants } from "@/lib/admin/meeting-time";
import { isArchivedTaskStatus, type Task } from "@/types/task";
import type { Meeting } from "@/types/meeting";

export type CalendarEvent = {
  id: string;
  kind: "task" | "meeting";
  title: string;
  date: string;
  startTime: string;
  endTime: string | null;
  color: CalendarColor;
  type: string;
  people: string[];
  projectId: string | null;
  departmentId: string | null;
  status: string;
  location: string | null;
};

export function taskToEvent(task: Task): CalendarEvent | null {
  const date = task.startDate || task.scheduledDate || task.dueDate;
  if (!date || !isDateOnly(date) || isArchivedTaskStatus(task.status)) return null;
  const startTime = task.startTime && isTimeOnly(task.startTime) ? task.startTime : "09:00";
  const minutes = task.estimatedHours && task.estimatedHours > 0 ? Math.round(task.estimatedHours * 60) : 60;
  const endTime = task.endTime && isTimeOnly(task.endTime) ? task.endTime : addMinutesToTime(startTime, minutes);
  const people = [task.assigneeId, ...task.collaboratorIds].filter((id): id is string => Boolean(id));
  return {
    id: task.id,
    kind: "task",
    title: task.title,
    date,
    startTime,
    endTime,
    color: asCalendarColor(task.color),
    type: task.taskType || "GENERAL",
    people,
    projectId: task.projectId,
    departmentId: task.departmentId,
    status: task.status,
    location: null,
  };
}

export function meetingToEvent(meeting: Meeting): CalendarEvent | null {
  if (!isDateOnly(meeting.date) || !isTimeOnly(meeting.startTime)) return null;
  return {
    id: meeting.id,
    kind: "meeting",
    title: meeting.title,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    color: asCalendarColor(meeting.color),
    type: meeting.meetingType,
    people: meetingParticipants(meeting),
    projectId: meeting.projectId,
    departmentId: null,
    status: meeting.status,
    location: meeting.location,
  };
}

export function eventDuration(event: CalendarEvent) {
  return durationMinutes(event.startTime, event.endTime);
}

export function eventMatchesEmployee(event: CalendarEvent, employeeId: string | null) {
  if (!employeeId) return false;
  return event.people.includes(employeeId);
}

export function taskMatchesFilter(task: Task, employeeId: string | null) {
  return isEmployeeOnTask(task, employeeId);
}
