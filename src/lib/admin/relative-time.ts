export function relativeTimeLabel(value: Date | null | undefined) {
  if (!value) return "";
  const minutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60000));
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

export function clockLabel(value: Date | null | undefined) {
  if (!value) return "";
  return value.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
