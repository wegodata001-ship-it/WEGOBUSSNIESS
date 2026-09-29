export const STATUS_LABELS: Record<string, string> = {
  TODO: "לביצוע",
  OPEN: "לביצוע",
  PENDING: "ממתין",
  PENDING_APPROVAL: "ממתינה לאישור",
  IN_PROGRESS: "בביצוע",
  WAITING: "בהמתנה",
  DONE: "הושלמה",
  COMPLETED: "הושלמה",
  REJECTED: "נדחתה",
  OVERDUE: "באיחור",
  CANCELLED: "בוטל",
  ARCHIVED: "ארכיון",
  SCHEDULED: "מתוכנן",
  APPROVED: "אושר",
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
  CUSTOM: "מסמך מותאם",
  DRAFT: "טיוטה",
  SENT: "נשלח",
  VIEWED: "נצפה",
  SIGNED: "נחתם",
  EXPIRED: "פג תוקף",
  BRIEF: "בריף",
  DESIGN: "עיצוב",
  CLIENT: "מסמך לקוח",
  UNPAID: "לא שולם",
  PARTIALLY_PAID: "שולם חלקית",
  PAID: "שולם",
  CASH: "מזומן",
  CREDIT_CARD: "כרטיס אשראי",
  BANK_TRANSFER: "העברה בנקאית",
  CHECK: "צ'ק",
};

export function labelOf(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  return STATUS_LABELS[value] ?? value;
}

export function statusTone(value: string | null | undefined) {
  if (!value) return "gray";
  if (["DONE", "COMPLETED", "APPROVED", "FULFILLED", "ACTIVE"].includes(value)) return "green";
  if (["IN_PROGRESS", "SCHEDULED", "TODO", "OPEN"].includes(value)) return "blue";
  if (["WAITING", "PENDING", "PENDING_APPROVAL", "NEED_INFO", "ON_HOLD"].includes(value)) return "orange";
  if (["URGENT", "OVERDUE", "REJECTED", "CANCELLED", "UNPAID"].includes(value)) return "red";
  if (["PARTIALLY_PAID"].includes(value)) return "orange";
  if (["PAID"].includes(value)) return "green";
  return "gray";
}
