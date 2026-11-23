import { isDateOnly, todayInTimeZone, type DateOnly } from "@/lib/dates/format";

export function safeTodayInTimeZone(timeZone?: string | null): DateOnly {
  // todayInTimeZone already coerces empty/invalid zones.
  return todayInTimeZone(timeZone ?? undefined);
}

/** Normalize any picker value to YYYY-MM-DD, never throw. */
export function normalizeDatePickerValue(
  value: unknown,
  timeZone?: string | null,
): DateOnly {
  if (typeof value === "string" && isDateOnly(value.trim())) {
    return value.trim();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    const stamp = `${year}-${month}-${day}`;
    if (isDateOnly(stamp)) return stamp;
  }
  if (typeof value === "string" && value) {
    const sliced = value.slice(0, 10);
    if (isDateOnly(sliced)) return sliced;
  }
  return safeTodayInTimeZone(timeZone);
}

export function buildDatePickerCells(value: unknown, timeZone?: string | null) {
  const normalized = normalizeDatePickerValue(value, timeZone);
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const today = safeTodayInTimeZone(timeZone);
    return buildDatePickerCells(today, timeZone);
  }

  const first = new Date(Date.UTC(year, month - 1, 1));
  if (Number.isNaN(first.getTime())) {
    const today = safeTodayInTimeZone(timeZone);
    return buildDatePickerCells(today, timeZone);
  }

  const startWeekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const length = startWeekday + daysInMonth;
  if (!Number.isFinite(length) || length < 28 || length > 42) {
    const today = safeTodayInTimeZone(timeZone);
    return { value: today, year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)), cells: [] as Array<string | null>, today };
  }

  const cells = Array.from({ length }, (_, index) => {
    if (index < startWeekday) return null;
    const day = index - startWeekday + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });

  return {
    value: normalized,
    year,
    month,
    cells,
    today: safeTodayInTimeZone(timeZone),
  };
}

export function shiftDatePickerMonth(value: unknown, delta: number, timeZone?: string | null): DateOnly {
  const normalized = normalizeDatePickerValue(value, timeZone);
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));
  const day = Number(normalized.slice(8, 10));
  const next = new Date(Date.UTC(year, month - 1 + delta, Math.min(day, 28)));
  // Clamp to last day of target month using original day when possible.
  const targetYear = next.getUTCFullYear();
  const targetMonth = next.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const stamp = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  return normalizeDatePickerValue(stamp, timeZone);
}
