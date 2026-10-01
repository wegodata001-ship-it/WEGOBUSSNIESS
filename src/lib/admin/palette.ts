import { getI18nLocale, translate, type MessageKey } from "@/lib/i18n";

export const CALENDAR_COLORS = ["BLUE", "GREEN", "PURPLE", "ORANGE", "RED", "PINK", "YELLOW", "CYAN"] as const;
export type CalendarColor = (typeof CALENDAR_COLORS)[number];

export const CALENDAR_COLOR_META: Record<CalendarColor, { label: string; bg: string; border: string; text: string; dot: string }> = {
  BLUE: { label: "כחול", bg: "bg-sky-50", border: "border-sky-400", text: "text-sky-950", dot: "bg-sky-500" },
  GREEN: { label: "ירוק", bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-950", dot: "bg-emerald-500" },
  PURPLE: { label: "סגול", bg: "bg-violet-50", border: "border-violet-400", text: "text-violet-950", dot: "bg-violet-500" },
  ORANGE: { label: "כתום", bg: "bg-orange-50", border: "border-orange-400", text: "text-orange-950", dot: "bg-orange-500" },
  RED: { label: "אדום", bg: "bg-rose-50", border: "border-rose-400", text: "text-rose-950", dot: "bg-rose-500" },
  PINK: { label: "ורוד", bg: "bg-pink-50", border: "border-pink-400", text: "text-pink-950", dot: "bg-pink-500" },
  YELLOW: { label: "צהוב", bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-950", dot: "bg-amber-400" },
  CYAN: { label: "טורקיז", bg: "bg-cyan-50", border: "border-cyan-400", text: "text-cyan-950", dot: "bg-cyan-500" },
};

export const TASK_TYPES = ["GENERAL", "WORK", "CALL", "MEETING", "PHOTO", "SYSTEMS", "MANAGEMENT", "OTHER"] as const;
export type TaskKind = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskKind, string> = {
  GENERAL: "כללי",
  WORK: "עבודה",
  CALL: "שיחה",
  MEETING: "פגישה",
  PHOTO: "צילום",
  SYSTEMS: "מערכות",
  MANAGEMENT: "ניהול",
  OTHER: "אחר",
};

export function taskTypeLabel(kind: string | null | undefined) {
  const key = `taskType.${kind || "GENERAL"}` as MessageKey;
  const translated = translate(getI18nLocale(), key);
  return translated !== key ? translated : TASK_TYPE_LABELS[(kind as TaskKind) || "GENERAL"] ?? kind ?? "";
}

export const PRIORITY_CHIPS = [
  { id: "LOW", label: "נמוכה", dot: "bg-slate-400" },
  { id: "NORMAL", label: "בינונית", dot: "bg-sky-500" },
  { id: "HIGH", label: "גבוהה", dot: "bg-orange-500" },
  { id: "URGENT", label: "דחוף", dot: "bg-red-500" },
] as const;

export function asCalendarColor(value: unknown): CalendarColor {
  return CALENDAR_COLORS.includes(value as CalendarColor) ? value as CalendarColor : "BLUE";
}

export function asTaskKind(value: unknown): TaskKind {
  return TASK_TYPES.includes(value as TaskKind) ? value as TaskKind : "GENERAL";
}

export function colorClasses(color: unknown) {
  return CALENDAR_COLOR_META[asCalendarColor(color)];
}

export function colorByIndex(index: number) {
  return CALENDAR_COLORS[Math.abs(index) % CALENDAR_COLORS.length];
}
