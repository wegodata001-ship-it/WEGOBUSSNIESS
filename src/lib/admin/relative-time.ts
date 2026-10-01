import { toSafeDate, toTimestamp } from "@/lib/dates/timestamp";

import { getI18nLocale, translate } from "@/lib/i18n";

export function relativeTimeLabel(value: unknown) {
  const time = toTimestamp(value);
  if (!time) return "";
  const locale = getI18nLocale();
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return translate(locale, "time.now");
  if (minutes < 60) return translate(locale, "time.minutesAgo", { count: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate(locale, "time.hoursAgo", { count: String(hours) });
  const days = Math.floor(hours / 24);
  if (days === 1) return translate(locale, "time.yesterday");
  return translate(locale, "time.daysAgo", { count: String(days) });
}

export function clockLabel(value: unknown) {
  const date = toSafeDate(value);
  if (!date) return "";
  return date.toLocaleTimeString(getI18nLocale() === "ar" ? "ar-IL" : "he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

export function dateTimeLabel(value: unknown) {
  const date = toSafeDate(value);
  if (!date) return "";
  return date.toLocaleString(getI18nLocale() === "ar" ? "ar-IL" : "he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}
