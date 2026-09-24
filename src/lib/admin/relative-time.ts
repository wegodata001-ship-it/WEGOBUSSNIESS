import { toSafeDate, toTimestamp } from "@/lib/dates/timestamp";

export function relativeTimeLabel(value: unknown) {
  const time = toTimestamp(value);
  if (!time) return "";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

export function clockLabel(value: unknown) {
  const date = toSafeDate(value);
  if (!date) return "";
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

export function dateTimeLabel(value: unknown) {
  const date = toSafeDate(value);
  if (!date) return "";
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}
