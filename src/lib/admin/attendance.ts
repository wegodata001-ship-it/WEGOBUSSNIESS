import { dateTimeInZone } from "@/lib/admin/meeting-time";
import { DEFAULT_TIMEZONE } from "@/lib/env";
import type { Employee } from "@/types/employee";
import type { WorkSession } from "@/types/work-hours";

export function isAttendanceSession(session: WorkSession) {
  return session.kind === "ATTENDANCE" || !session.taskId;
}

export function openAttendanceFor(sessions: WorkSession[], employeeId: string | null | undefined) {
  if (!employeeId) return null;
  return sessions.find((session) =>
    session.employeeId === employeeId
    && session.status === "OPEN"
    && isAttendanceSession(session),
  ) ?? null;
}

export function attendanceSessions(sessions: WorkSession[]) {
  return sessions.filter(isAttendanceSession);
}

export function clockTimeInZone(value: Date | null, timeZone = DEFAULT_TIMEZONE) {
  if (!value) return null;
  return dateTimeInZone(value, timeZone)?.time ?? null;
}

export function formatLiveDuration(startedAt: Date | null, now = Date.now()) {
  if (!startedAt) return "00:00:00";
  const total = Math.max(0, Math.floor((now - startedAt.getTime()) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatHoursMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${hours}:${String(rest).padStart(2, "0")}`;
}

export function formatDurationWords(minutes: number, locale: "he" | "ar" = "he") {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (locale === "ar") {
    return `${hours} ساعات ${rest} دقائق`;
  }
  return `${hours} שעות ${rest} דקות`;
}

export function sessionMinutes(session: WorkSession, now = Date.now()) {
  if (session.status === "OPEN" && session.startedAt) {
    return Math.max(0, Math.round((now - session.startedAt.getTime()) / 60000));
  }
  return session.durationMinutes ?? 0;
}

export function minutesInRange(sessions: WorkSession[], employeeId: string, from: string, to: string) {
  return sessions
    .filter((session) => session.employeeId === employeeId && session.date >= from && session.date <= to && isAttendanceSession(session))
    .reduce((sum, session) => sum + sessionMinutes(session), 0);
}

export function attendanceStatusLabel(status: WorkSession["status"], locale: "he" | "ar" = "he") {
  if (status === "OPEN") return locale === "ar" ? "في العمل" : "בעבודה";
  return locale === "ar" ? "مكتمل" : "הושלם";
}

export function employeeById(employees: Employee[], id: string | null | undefined) {
  return employees.find((item) => item.id === id) ?? null;
}
