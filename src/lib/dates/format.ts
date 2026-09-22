import { DEFAULT_TIMEZONE } from "@/lib/env";
import type { Locale } from "@/types/roles";

export type DateOnly = string;
export type TimeOnly = string;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_ONLY = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateOnly(value: string): value is DateOnly {
  return DATE_ONLY.test(value);
}

export function isTimeOnly(value: string): value is TimeOnly {
  return TIME_ONLY.test(value);
}

export function assertNotLegacySheetDate(date: Date) {
  if (date.getUTCFullYear() <= 1899) {
    throw new Error("Legacy spreadsheet time value detected (1899-12-30).");
  }
}

function localeTag(locale: Locale) {
  return locale === "ar" ? "ar-IL" : "he-IL";
}

export function shiftDateOnly(value: DateOnly, days: number): DateOnly {
  if (!isDateOnly(value)) {
    throw new Error("Expected a DATE value in YYYY-MM-DD format.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const nextYear = utcDate.getUTCFullYear();
  const nextMonth = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function todayInTimeZone(timeZone = DEFAULT_TIMEZONE): DateOnly {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function formatBusinessDate(
  value: Date | DateOnly,
  locale: Locale,
  timeZone = DEFAULT_TIMEZONE,
) {
  if (typeof value === "string") {
    if (!isDateOnly(value)) {
      throw new Error("Expected a DATE value in YYYY-MM-DD format.");
    }
    const [year, month, day] = value.split("-").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat(localeTag(locale), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(utcDate);
  }

  assertNotLegacySheetDate(value);
  return new Intl.DateTimeFormat(localeTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(value);
}

export function formatBusinessTime(
  value: Date | TimeOnly,
  locale: Locale,
  timeZone = DEFAULT_TIMEZONE,
) {
  if (typeof value === "string") {
    if (!isTimeOnly(value)) {
      throw new Error("Expected a TIME value in HH:mm format.");
    }
    return value;
  }

  assertNotLegacySheetDate(value);
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(value);
}

export function formatBusinessTimestamp(
  value: Date,
  locale: Locale,
  timeZone = DEFAULT_TIMEZONE,
) {
  assertNotLegacySheetDate(value);
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(value);
}
