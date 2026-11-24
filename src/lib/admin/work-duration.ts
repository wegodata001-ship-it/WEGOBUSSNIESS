/**
 * Work duration policy (Asia/Jerusalem timestamps included):
 * - Source of truth for closed sessions: stored `durationMinutes` (already rounded once at close).
 * - Live / open sessions: round((endedAt - startedAt) / 60000) once — never re-round formatted fragments.
 * - Clock labels (HH:MM) drop seconds; wall-clock minute delta can differ from stored minutes by ±1.
 * - Totals: sum integer minutes first, then format once.
 */

export type DurationLocale = "he" | "ar";

export function durationMinutesBetween(
  startedAt: Date | number | null | undefined,
  endedAt: Date | number | null | undefined,
): number {
  const start = toMs(startedAt);
  const end = toMs(endedAt);
  if (start === null || end === null || end < start) return 0;
  return Math.max(0, Math.round((end - start) / 60_000));
}

/** HH:MM labels only — ignores seconds (explains 08:50→11:29 looking like 159 while actual may be 158). */
export function clockLabelMinutesDelta(startTime: string, endTime: string): number | null {
  const start = parseClock(startTime);
  const end = parseClock(endTime);
  if (start === null || end === null) return null;
  let delta = end - start;
  if (delta < 0) delta += 24 * 60;
  return delta;
}

export function normalizeDurationMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.round(minutes));
}

export function splitDuration(minutes: number): { hours: number; minutes: number; totalMinutes: number } {
  const totalMinutes = normalizeDurationMinutes(minutes);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    totalMinutes,
  };
}

/** Compact H:MM (no unit). Uses already-normalized integer minutes. */
export function formatHoursMinutes(minutes: number): string {
  const { hours, minutes: rest } = splitDuration(minutes);
  return `${hours}:${String(rest).padStart(2, "0")}`;
}

/**
 * Human duration for UI / CSV / PDF.
 * 90 → "שעה ו-30 דקות" / "ساعة و-30 دقائق"
 * 135 → "2 שעות و-15 דקות"
 * 480 → "8 שעות"
 */
export function formatDurationWords(minutes: number, locale: DurationLocale = "he"): string {
  const { hours, minutes: rest, totalMinutes } = splitDuration(minutes);
  if (totalMinutes === 0) {
    return locale === "ar" ? `0 ${AR_MINUTES}` : `0 ${HE_MINUTES}`;
  }
  if (hours === 0) {
    return formatMinutesPart(rest, locale);
  }
  const hoursPart = formatHoursPart(hours, locale);
  if (rest === 0) return hoursPart;
  const join = locale === "ar" ? AR_JOIN : HE_JOIN;
  return `${hoursPart}${join}${formatMinutesPart(rest, locale)}`;
}

/** Export cell with explicit unit words (same as UI). */
export function formatDurationForExport(minutes: number, locale: DurationLocale = "he"): string {
  return formatDurationWords(minutes, locale);
}

export function sumMinutes(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += normalizeDurationMinutes(value);
  }
  return total;
}

const HE_JOIN = " \u05d5-"; // ו-
const AR_JOIN = " \u0648-"; // و-
const HE_HOUR = "\u05e9\u05e2\u05d4";
const HE_HOURS = "\u05e9\u05e2\u05d5\u05ea";
const HE_MINUTE = "\u05d3\u05e7\u05d4";
const HE_MINUTES = "\u05d3\u05e7\u05d5\u05ea";
const AR_HOUR = "\u0633\u0627\u0639\u0629";
const AR_HOURS = "\u0633\u0627\u0639\u0627\u062a";
const AR_MINUTE = "\u062f\u0642\u064a\u0642\u0629";
const AR_MINUTES = "\u062f\u0642\u0627\u0626\u0642";

function toMs(value: Date | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const ms = value.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatHoursPart(hours: number, locale: DurationLocale): string {
  if (locale === "ar") {
    if (hours === 1) return AR_HOUR;
    return `${hours} ${AR_HOURS}`;
  }
  if (hours === 1) return HE_HOUR;
  return `${hours} ${HE_HOURS}`;
}

function formatMinutesPart(minutes: number, locale: DurationLocale): string {
  if (locale === "ar") {
    if (minutes === 1) return AR_MINUTE;
    return `${minutes} ${AR_MINUTES}`;
  }
  if (minutes === 1) return HE_MINUTE;
  return `${minutes} ${HE_MINUTES}`;
}
