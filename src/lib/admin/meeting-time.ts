import { DEFAULT_TIMEZONE } from "@/lib/env";
import { isDateOnly, isTimeOnly, shiftDateOnly, type DateOnly, type TimeOnly } from "@/lib/dates/format";
import type { Meeting } from "@/types/meeting";

export const CALENDAR_HOUR_START = 7;
export const CALENDAR_HOUR_END = 22;
export const PX_PER_HOUR = 72;
export const SNAP_MINUTES = 15;

export const WEEKDAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] as const;
export const WEEKDAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;
export const MONTH_NAMES_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
] as const;

export const MEETING_HOURS = Array.from(
  { length: CALENDAR_HOUR_END - CALENDAR_HOUR_START + 1 },
  (_, index) => `${String(CALENDAR_HOUR_START + index).padStart(2, "0")}:00`,
);

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function isLegacySheetDate(value: Date | null | undefined) {
  return Boolean(value && (Number.isNaN(value.getTime()) || value.getUTCFullYear() <= 1899));
}

export function toSafeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isLegacySheetDate(value) ? null : value;
  }
  if (typeof value === "object" && value !== null) {
    if ("toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
      const next = (value as { toDate: () => Date }).toDate();
      return isLegacySheetDate(next) ? null : next;
    }
    const seconds = Number(
      (value as { seconds?: number; _seconds?: number }).seconds
      ?? (value as { _seconds?: number })._seconds,
    );
    if (Number.isFinite(seconds)) {
      const next = new Date(seconds * 1000);
      return isLegacySheetDate(next) ? null : next;
    }
  }
  if (typeof value === "string" && value.trim()) {
    if (isDateOnly(value.trim())) return null;
    const next = new Date(value);
    return isLegacySheetDate(next) ? null : next;
  }
  return null;
}

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") === 24 ? 0 : read("hour"),
    minute: read("minute"),
  };
}

export function dateTimeInZone(date: Date, timeZone = DEFAULT_TIMEZONE) {
  if (isLegacySheetDate(date)) return null;
  const parts = zoneParts(date, timeZone);
  if (!parts.year || !parts.month || !parts.day) return null;
  const dateOnly = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const timeOnly = `${pad(parts.hour)}:${pad(parts.minute)}`;
  if (!isDateOnly(dateOnly) || !isTimeOnly(timeOnly)) return null;
  return { date: dateOnly, time: timeOnly };
}

export function zonedDateTime(dateOnly: string, timeOnly: string, timeZone = DEFAULT_TIMEZONE): Date | null {
  if (!isDateOnly(dateOnly) || !isTimeOnly(timeOnly)) return null;
  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hour, minute] = timeOnly.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let index = 0; index < 4; index += 1) {
    const got = zoneParts(new Date(utc), timeZone);
    const gotStamp = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute);
    const wantStamp = Date.UTC(year, month - 1, day, hour, minute);
    utc += wantStamp - gotStamp;
  }
  const result = new Date(utc);
  return isLegacySheetDate(result) ? null : result;
}

export function formatDateDisplay(dateOnly: string) {
  if (!isDateOnly(dateOnly)) return "";
  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
}

export function formatMonthTitle(dateOnly: string) {
  if (!isDateOnly(dateOnly)) return "";
  const [year, month] = dateOnly.split("-").map(Number);
  return `${MONTH_NAMES_HE[month - 1]} ${year}`;
}

export function formatDayTitle(dateOnly: string) {
  if (!isDateOnly(dateOnly)) return "";
  const [year, month, day] = dateOnly.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return `${WEEKDAY_NAMES[utc.getUTCDay()]}, ${Number(day)} ב${MONTH_NAMES_HE[month - 1]}`;
}

export function weekdayIndex(dateOnly: string) {
  if (!isDateOnly(dateOnly)) return 0;
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

export function startOfWeekSunday(dateOnly: DateOnly): DateOnly {
  return shiftDateOnly(dateOnly, -weekdayIndex(dateOnly));
}

export function weekDates(anchor: DateOnly) {
  const start = startOfWeekSunday(anchor);
  return Array.from({ length: 7 }, (_, index) => shiftDateOnly(start, index));
}

export function threeDayDates(anchor: DateOnly) {
  return Array.from({ length: 3 }, (_, index) => shiftDateOnly(anchor, index));
}

export function monthCells(anchor: DateOnly) {
  if (!isDateOnly(anchor)) return [];
  const [year, month] = anchor.split("-").map(Number);
  const firstDow = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: firstDow }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${year}-${pad(month)}-${pad(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function minutesOf(timeOnly: string) {
  if (!isTimeOnly(timeOnly)) return 0;
  const [hour, minute] = timeOnly.split(":").map(Number);
  return hour * 60 + minute;
}

export function timeFromMinutes(total: number): TimeOnly {
  const clamped = Math.max(CALENDAR_HOUR_START * 60, Math.min(CALENDAR_HOUR_END * 60 + 45, total));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

export function snapMinutes(total: number, step = SNAP_MINUTES) {
  return Math.round(total / step) * step;
}

export function addMinutesToTime(timeOnly: string, delta: number) {
  return timeFromMinutes(minutesOf(timeOnly) + delta);
}

export function durationMinutes(startTime: string, endTime: string | null) {
  if (!endTime || !isTimeOnly(endTime)) return 60;
  return Math.max(SNAP_MINUTES, minutesOf(endTime) - minutesOf(startTime));
}

export function minutesFromCalendarStart(timeOnly: string) {
  return minutesOf(timeOnly) - CALENDAR_HOUR_START * 60;
}

export function timeFromClientY(offsetY: number, pxPerHour = PX_PER_HOUR) {
  const raw = CALENDAR_HOUR_START * 60 + (offsetY / pxPerHour) * 60;
  return timeFromMinutes(snapMinutes(raw));
}

export function meetingParticipants(meeting: Pick<Meeting, "participantIds" | "participantEmployeeIds">) {
  return meeting.participantIds.length ? meeting.participantIds : meeting.participantEmployeeIds;
}

export function meetingOnDate(meeting: Meeting, dateOnly: string) {
  return Boolean(dateOnly) && isDateOnly(meeting.date) && meeting.date === dateOnly;
}

export function shiftMonth(anchor: DateOnly, direction: -1 | 1): DateOnly {
  const [year, month, day] = anchor.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + direction, 1, 12, 0, 0));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0, 12, 0, 0)).getUTCDate();
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
}

export function shiftMeetingRange(view: "month" | "week" | "day" | "three" | "agenda", anchor: DateOnly, direction: -1 | 1) {
  if (view === "month") return shiftMonth(anchor, direction);
  if (view === "week") return shiftDateOnly(anchor, direction * 7);
  if (view === "three") return shiftDateOnly(anchor, direction * 3);
  return shiftDateOnly(anchor, direction);
}

export function rangeTitle(view: "month" | "week" | "day" | "three" | "agenda", anchor: DateOnly) {
  if (view === "day") return formatDayTitle(anchor);
  if (view === "week") {
    const days = weekDates(anchor);
    const start = days[0]!;
    const end = days[6]!;
    if (start.slice(0, 7) === end.slice(0, 7)) {
      return `${Number(start.slice(8))}–${Number(end.slice(8))} ${formatMonthTitle(start)}`;
    }
    return `${formatDateDisplay(start)} – ${formatDateDisplay(end)}`;
  }
  if (view === "three") {
    const days = threeDayDates(anchor);
    return `${formatDateDisplay(days[0]!)} – ${formatDateDisplay(days[2]!)}`;
  }
  return formatMonthTitle(anchor);
}

export function nowClock(timeZone = DEFAULT_TIMEZONE) {
  return dateTimeInZone(new Date(), timeZone);
}
