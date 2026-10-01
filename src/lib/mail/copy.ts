import type { Locale } from "@/types/roles";

const COPY = {
  he: {
    openTask: "פתח משימה",
    openRequest: "פתח בקשה",
    openMeeting: "פתח פגישה",
    openApp: "פתיחה במערכת",
    task: "משימה",
    project: "פרויקט",
    employee: "עובד",
    date: "תאריך",
    time: "שעה",
    status: "סטטוס",
    priority: "עדיפות",
    deadline: "דדליין",
    late: "איחור",
    meeting: "פגישה",
    request: "בקשה",
    client: "לקוח",
    location: "מיקום",
    assignee: "אחראי",
  },
  ar: {
    openTask: "فتح المهمة",
    openRequest: "فتح الطلب",
    openMeeting: "فتح الاجتماع",
    openApp: "فتح النظام",
    task: "المهمة",
    project: "المشروع",
    employee: "الموظف",
    date: "التاريخ",
    time: "الساعة",
    status: "الحالة",
    priority: "الأولوية",
    deadline: "الموعد",
    late: "التأخير",
    meeting: "الاجتماع",
    request: "الطلب",
    client: "العميل",
    location: "الموقع",
    assignee: "المسؤول",
  },
} as const;

export function mailCopy(locale: Locale) {
  return locale === "ar" ? COPY.ar : COPY.he;
}

export function ctaForEntity(entityType: string | undefined, locale: Locale) {
  const text = mailCopy(locale);
  if (entityType === "request") return text.openRequest;
  if (entityType === "meeting") return text.openMeeting;
  if (entityType === "task") return text.openTask;
  return text.openApp;
}
