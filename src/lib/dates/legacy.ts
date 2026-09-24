const TIMEZONE = "Asia/Jerusalem";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function zonedDateTime(dateOnly: string, timeOnly: string, timeZone = TIMEZONE) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timeOnly.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let index = 0; index < 4; index += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const hourValue = read("hour") === 24 ? 0 : read("hour");
    utc += Date.UTC(year, month - 1, day, hour, minute, second)
      - Date.UTC(read("year"), read("month") - 1, read("day"), hourValue, read("minute"), read("second"));
  }
  return new Date(utc);
}

export function parseLegacyDateTime(value: unknown): {
  dateOnly: string;
  timeOnly: string;
  at: Date;
} | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || raw.toUpperCase() === "NULL") return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (iso) {
    const dateOnly = `${iso[1]}-${iso[2]}-${iso[3]}`;
    const timeOnly = `${pad(Number(iso[4] ?? 0))}:${pad(Number(iso[5] ?? 0))}:${pad(Number(iso[6] ?? 0))}`;
    return { dateOnly, timeOnly, at: zonedDateTime(dateOnly, timeOnly) };
  }

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!slash) return null;

  const first = Number(slash[1]);
  const second = Number(slash[2]);
  const year = Number(slash[3]);
  if (!year || first <= 0 || second <= 0) return null;

  let day: number;
  let month: number;
  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  } else if (second > 12 && first <= 12) {
    month = first;
    day = second;
  } else if (slash[1].length === 2 && slash[4]?.length === 2) {
    day = first;
    month = second;
  } else {
    month = first;
    day = second;
  }

  if (month > 12 || day > 31) return null;
  const dateOnly = `${year}-${pad(month)}-${pad(day)}`;
  const timeOnly = `${pad(Number(slash[4] ?? 0))}:${pad(Number(slash[5] ?? 0))}:${pad(Number(slash[6] ?? 0))}`;
  return { dateOnly, timeOnly, at: zonedDateTime(dateOnly, timeOnly) };
}

export function legacyDateTimeLabel(value: unknown) {
  const parsed = value instanceof Date || typeof value === "string" || typeof value === "number"
    ? parseLegacyDateTime(value instanceof Date
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
      : value)
    : null;
  if (parsed) return `${parsed.dateOnly.slice(8, 10)}/${parsed.dateOnly.slice(5, 7)}/${parsed.dateOnly.slice(0, 4)} ${parsed.timeOnly.slice(0, 5)}`;
  return "";
}
