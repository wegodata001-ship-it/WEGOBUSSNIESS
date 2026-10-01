import { todayInTimeZone, shiftDateOnly } from "@/lib/dates/format";
import { getAdminDb } from "@/lib/firebase/admin";
import { businessDocPath, collections, employeesPath, meetingsPath, tasksPath } from "@/lib/firebase/paths";
import { isCompletedTaskStatus } from "@/lib/admin/project-progress";
import { isOverdue } from "@/lib/admin/time";
import { MAIL_BRAND } from "@/lib/mail/env";
import { toTask } from "@/lib/firebase/converters";
import { loadNotificationSettings } from "@/lib/notify/settings";
import { sendAdminNotification, sendEmployeeNotification } from "@/lib/notify/service";
import { isArchivedTaskStatus, type Task } from "@/types/task";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function businessHour(timeZone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  return Number.isFinite(hour) ? hour : 0;
}

function minutesUntil(iso: Date | null, now: number) {
  if (!iso) return null;
  return Math.round((iso.getTime() - now) / 60000);
}

async function loadBusinessTasks(businessId: string) {
  const snap = await getAdminDb().collection(tasksPath(businessId)).get();
  return snap.docs.map((docSnap) => toTask(docSnap.id, docSnap.data()));
}

export async function runNotificationJobs(input?: { businessId?: string; forceMorning?: boolean }) {
  const db = getAdminDb();
  const businesses = input?.businessId
    ? [{ id: input.businessId }]
    : (await db.collection(collections.businesses).get()).docs.map((docSnap) => ({ id: docSnap.id }));

  const summary = { businesses: 0, overdue: 0, upcoming: 0, today: 0, digest: 0, meetings: 0 };

  for (const business of businesses) {
    const bizSnap = await db.doc(businessDocPath(business.id)).get();
    if (!bizSnap.exists) continue;
    const timezone = text(bizSnap.data()?.timezone) || "Asia/Jerusalem";
    const today = todayInTimeZone(timezone);
    const hour = businessHour(timezone);
    const morning = input?.forceMorning || (hour >= 7 && hour < 10);
    const tasks = await loadBusinessTasks(business.id);
    const settings = await loadNotificationSettings(business.id);

    if (morning) {
      summary.overdue += await sendOverdue(business.id, tasks, today);
      summary.upcoming += await sendUpcoming(business.id, tasks, today);
      summary.today += await sendEmployeeToday(business.id, tasks, today, timezone);
      summary.digest += await sendAdminDigest(business.id, tasks, today, timezone);
    }

    summary.meetings += await sendMeetingReminders(business.id, timezone, settings.meetingReminderMinutes, settings.meetingReminderEmail);
    summary.businesses += 1;
  }

  return summary;
}

async function sendOverdue(businessId: string, tasks: Task[], today: string) {
  let count = 0;
  for (const task of tasks) {
    if (!isOverdue(task, today)) continue;
    const late = Math.max(1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${task.dueDate}T12:00:00Z`)) / 86400000));
    const employeeIds = [task.assigneeId, ...task.collaboratorIds].filter((id): id is string => Boolean(id));
    if (employeeIds.length) {
      await sendEmployeeNotification({
        businessId,
        type: "task.overdue",
        title: "⚠ משימה באיחור",
        message: task.title,
        href: `/tasks?taskId=${encodeURIComponent(task.id)}`,
        entityType: "task",
        entityId: task.id,
        employeeIds,
        rows: [
          { label: "משימה", value: task.title },
          { label: "דדליין", value: task.dueDate || "" },
          { label: "איחור", value: `${late} ימים` },
        ],
        subject: `${MAIL_BRAND} — משימה באיחור`,
        dedupeKey: `OVERDUE:${task.id}:${today}`,
      });
    }
    await sendAdminNotification({
      businessId,
      type: "task.overdue",
      title: "⚠ משימה באיחור",
      message: `${task.title} באיחור של ${late} ימים`,
      href: `/tasks?taskId=${encodeURIComponent(task.id)}`,
      entityType: "task",
      entityId: task.id,
      rows: [
        { label: "משימה", value: task.title },
        { label: "דדליין", value: task.dueDate || "" },
        { label: "איחור", value: `${late} ימים` },
      ],
      subject: `${MAIL_BRAND} — משימה באיחור`,
      channels: { inApp: true, email: false },
      dedupeKey: `OVERDUE_ADMIN:${task.id}:${today}`,
    });
    count += 1;
  }
  return count;
}

async function sendUpcoming(businessId: string, tasks: Task[], today: string) {
  const tomorrow = shiftDateOnly(today, 1);
  let count = 0;
  for (const task of tasks) {
    if (isCompletedTaskStatus(task.status) || isArchivedTaskStatus(task.status)) continue;
    const when = task.scheduledDate || task.dueDate;
    if (when !== tomorrow) continue;
    const employeeIds = [task.assigneeId, ...task.collaboratorIds].filter((id): id is string => Boolean(id));
    if (!employeeIds.length) continue;
    await sendEmployeeNotification({
      businessId,
      type: "task.reminder",
      title: "תזכורת: יש לך משימה למחר",
      message: task.title,
      href: `/tasks?taskId=${encodeURIComponent(task.id)}`,
      entityType: "task",
      entityId: task.id,
      employeeIds,
      rows: [
        { label: "משימה", value: task.title },
        { label: "שעה", value: task.startTime || "" },
      ],
      subject: `${MAIL_BRAND} — תזכורת למשימה`,
      dedupeKey: `UPCOMING:${task.id}:${tomorrow}`,
    });
    count += 1;
  }
  return count;
}

async function sendEmployeeToday(businessId: string, tasks: Task[], today: string, timezone: string) {
  const meetings = await getAdminDb().collection(meetingsPath(businessId)).get();
  const todayMeetings = meetings.docs
    .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }))
    .filter((item) => text(item.data.date) === today && text(item.data.status) !== "CANCELLED");
  const employees = await getAdminDb().collection(employeesPath(businessId)).get();
  let count = 0;

  for (const emp of employees.docs) {
    const data = emp.data();
    if (data.status === "INACTIVE" || data.active === false) continue;
    const mine = tasks.filter((task) => {
      if (isCompletedTaskStatus(task.status) || isArchivedTaskStatus(task.status)) return false;
      const mineTask = task.assigneeId === emp.id || task.collaboratorIds.includes(emp.id);
      const when = task.scheduledDate || task.dueDate;
      return mineTask && when === today;
    });
    const myMeetings = todayMeetings.filter((item) => {
      const ids = Array.isArray(item.data.participantIds) ? item.data.participantIds as string[] : [];
      return ids.includes(emp.id);
    });
    if (!mine.length && !myMeetings.length) continue;

    const lines = [
      ...myMeetings.map((item) => `${text(item.data.startTime) || "ללא שעה"} — ${text(item.data.title)}`),
      ...mine.map((task) => `${task.startTime || "ללא שעה"} — ${task.title}`),
    ].slice(0, 8);

    await sendEmployeeNotification({
      businessId,
      type: "employee.digest",
      title: "העבודה שלך להיום",
      message: `יש לך היום: ${mine.length} משימות, ${myMeetings.length} פגישות`,
      href: "/dashboard",
      employeeIds: [emp.id],
      rows: lines.map((line) => ({ label: today, value: line })),
      subject: `${MAIL_BRAND} — העבודה שלך להיום`,
      dedupeKey: `DAILY_WORK:${emp.id}:${today}`,
    });
    count += 1;
  }
  void timezone;
  return count;
}

async function sendAdminDigest(businessId: string, tasks: Task[], today: string, timezone: string) {
  const createdToday = tasks.filter((task) => {
    if (!task.createdAt) return false;
    const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(task.createdAt);
    return stamp === today;
  });
  const overdue = tasks.filter((task) => isOverdue(task, today));
  const pending = tasks.filter((task) => task.status === "PENDING_APPROVAL");
  const meetings = await getAdminDb().collection(meetingsPath(businessId)).get();
  const meetingsToday = meetings.docs.filter((docSnap) => text(docSnap.data().date) === today && text(docSnap.data().status) !== "CANCELLED");
  const openAssignees = new Set(tasks.filter((task) => !isCompletedTaskStatus(task.status) && !isArchivedTaskStatus(task.status) && task.assigneeId).map((task) => task.assigneeId));

  if (!createdToday.length && !overdue.length && !pending.length && !meetingsToday.length) return 0;

  const attention = [
    ...overdue.slice(0, 5).map((task) => `⚠ ${task.title}`),
    ...pending.slice(0, 5).map((task) => `🟡 ${task.title} — ממתינה לאישור`),
  ];

  await sendAdminNotification({
    businessId,
    type: "admin.digest",
    title: "סיכום ניהולי יומי",
    message: `משימות חדשות: ${createdToday.length}\nמשימות באיחור: ${overdue.length}\nממתינות לאישור: ${pending.length}\nפגישות היום: ${meetingsToday.length}\nעובדים עם משימות פתוחות: ${openAssignees.size}`,
    href: "/dashboard",
    rows: attention.map((line) => ({ label: "דורש טיפול", value: line })),
    subject: `${MAIL_BRAND} — סיכום ניהולי יומי`,
    channels: { inApp: true, email: true },
    dedupeKey: `DAILY_DIGEST:admin:${today}`,
  });
  return 1;
}

async function sendMeetingReminders(businessId: string, timezone: string, minutesList: number[], email: boolean) {
  const snap = await getAdminDb().collection(meetingsPath(businessId)).get();
  const now = Date.now();
  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (text(data.status) === "CANCELLED") continue;
    const startAt = data.startAt?.toDate?.() instanceof Date ? data.startAt.toDate() as Date : null;
    const mins = minutesUntil(startAt, now);
    if (mins === null) continue;
    const window = minutesList.find((item) => mins <= item && mins > item - 15);
    if (!window) continue;
    const participants = Array.isArray(data.participantIds) ? data.participantIds as string[] : [];
    if (!participants.length) continue;
    await sendEmployeeNotification({
      businessId,
      type: "meeting.reminder",
      title: `תזכורת לפגישה בעוד ${window} דקות`,
      message: text(data.title),
      href: "/meetings",
      entityType: "meeting",
      entityId: docSnap.id,
      employeeIds: participants,
      channels: { inApp: true, email },
      subject: `${MAIL_BRAND} — תזכורת לפגישה`,
      dedupeKey: `MEETING_REMINDER:${docSnap.id}:${window}:${todayInTimeZone(timezone)}`,
    });
    count += 1;
  }
  return count;
}
