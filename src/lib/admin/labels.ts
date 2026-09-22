export const STATUS_LABELS: Record<string, string> = {
  TODO: "לביצוע",
  OPEN: "לביצוע",
  PENDING: "ממתין",
  IN_PROGRESS: "בביצוע",
  WAITING: "ממתין",
  DONE: "הושלם",
  COMPLETED: "הושלם",
  OVERDUE: "באיחור",
  CANCELLED: "בוטל",
  ARCHIVED: "ארכיון",
  SCHEDULED: "מתוכנן",
  APPROVED: "אושר",
  REJECTED: "נדחה",
  NEED_INFO: "חסר מידע",
  FULFILLED: "הושלם",
  ACTIVE: "פעיל",
  INACTIVE: "לא פעיל",
  ON_HOLD: "מושהה",
  LOW: "נמוכה",
  NORMAL: "רגילה",
  MEDIUM: "בינונית",
  HIGH: "גבוהה",
  URGENT: "דחוף",
  EXPENSE: "אישור הוצאה",
  PURCHASE: "רכישה",
  EQUIPMENT: "ציוד",
  TRAVEL: "נסיעה",
  LOGISTICS: "לוגיסטיקה",
  LEAVE: "חופשה / היעדרות",
  OTHER: "אחר",
  QUOTE: "הצעת מחיר",
  INVOICE: "חשבונית",
  CONTRACT: "חוזה",
  BRIEF: "בריף",
  DESIGN: "עיצוב",
  CLIENT: "מסמך לקוח",
};

export function labelOf(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  return STATUS_LABELS[value] ?? value;
}

export function statusTone(value: string | null | undefined) {
  if (!value) return "gray";
  if (["DONE", "COMPLETED", "APPROVED", "FULFILLED", "ACTIVE"].includes(value)) return "green";
  if (["IN_PROGRESS", "SCHEDULED", "TODO", "OPEN"].includes(value)) return "blue";
  if (["WAITING", "PENDING", "NEED_INFO", "ON_HOLD"].includes(value)) return "orange";
  if (["URGENT", "OVERDUE", "REJECTED", "CANCELLED"].includes(value)) return "red";
  return "gray";
}
