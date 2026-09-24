import { departmentName, employeeName, projectName, sessionHours, type BusinessCatalog } from "@/lib/admin/catalog";
import { normalizeProjectProgress } from "@/lib/admin/project-progress";
import { buildSchedule } from "@/lib/admin/schedule";
import { daysBetween, isOverdue, openSessions, taskIsActive } from "@/lib/admin/time";
import { shiftDateOnly } from "@/lib/dates/format";
import { toTimestamp } from "@/lib/dates/timestamp";
import type { Employee } from "@/types/employee";
import type { LogisticsRequest } from "@/types/logistics";
import type { Meeting } from "@/types/meeting";
import type { Task } from "@/types/task";
import { isDoneTaskStatus, isPendingApproval } from "@/types/task";
import type { WorkSession } from "@/types/work-hours";

export type TeamPresence = "working" | "meeting" | "not_started" | "finished";

export type AttentionKind = "overdue_task" | "due_today" | "pending_request" | "upcoming_meeting" | "project_risk";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  title: string;
  meta: string;
  deadline: string;
  badge: string;
  href: string;
  action: string;
};

export type TeamNowRow = {
  id: string;
  name: string;
  department: string;
  initial: string;
  status: TeamPresence;
  currentTask: string | null;
  timeToday: string;
  clockInTime: string | null;
  startedAt: Date | null;
  hasTime: boolean;
};

export type TimelineItem = {
  id: string;
  time: string;
  title: string;
  meta: string;
  href: string;
  kind: "session" | "meeting" | "task";
};

export type ProjectHealth = {
  id: string;
  name: string;
  manager: string;
  status: string;
  progress: number;
  done: number;
  total: number;
  overdue: number;
  deadline: string | null;
  team: string[];
  health: "risk" | "on_track" | null;
};

export type WeeklySnapshot = {
  hours: number;
  completedTasks: number;
  newTasks: number;
  meetings: number;
  overdue: number;
  hoursDelta: number | null;
  completedDelta: number | null;
  newDelta: number | null;
  meetingsDelta: number | null;
  overdueDelta: number | null;
};

export type DepartmentLoad = {
  id: string;
  name: string;
  employees: number;
  openTasks: number;
  overdueTasks: number;
  hours: number;
};

function weekStart(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return shiftDateOnly(today, -utc.getUTCDay());
}

function inRange(date: string | null | undefined, from: string, to: string) {
  return Boolean(date) && date! >= from && date! <= to;
}

function minutesToday(sessions: WorkSession[], employeeId: string, today: string) {
  let minutes = 0;
  for (const session of sessions) {
    if (session.employeeId !== employeeId || session.date !== today) continue;
    if (session.status === "OPEN" && session.startedAt) {
      const started = toTimestamp(session.startedAt);
      if (started) minutes += Math.max(0, Math.round((Date.now() - started) / 60000));
    } else {
      minutes += session.durationMinutes ?? 0;
    }
  }
  return minutes;
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function overdueLabel(dueDate: string, today: string) {
  const days = Math.max(1, daysBetween(dueDate, today));
  return days === 1 ? "באיחור ביום" : `באיחור ב-${days} ימים`;
}

function nowTime(timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function inMeetingNow(meeting: Meeting, employeeId: string, today: string, clock: string) {
  if (meeting.date !== today || meeting.status === "CANCELLED") return false;
  if (!meeting.participantIds.includes(employeeId) && !meeting.participantEmployeeIds.includes(employeeId)) {
    return false;
  }
  const start = meeting.startTime || "00:00";
  const end = meeting.endTime || "23:59";
  return clock >= start && clock <= end;
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildDashboardModel(data: BusinessCatalog, today: string, timeZone: string) {
  const clock = nowTime(timeZone);
  const thisWeekFrom = weekStart(today);
  const lastWeekFrom = shiftDateOnly(thisWeekFrom, -7);
  const lastWeekTo = shiftDateOnly(thisWeekFrom, -1);
  const activeEmployees = data.employees.filter((employee) => employee.status === "ACTIVE");
  const running = openSessions(data.sessions);
  const openTasks = data.tasks.filter(taskIsActive);
  const overdueTasks = data.tasks.filter((task) => isOverdue(task, today));
  const dueToday = openTasks.filter((task) => task.dueDate === today && !isOverdue(task, today));
  const pendingRequests = data.requests.filter((item) => item.status === "PENDING" || item.status === "NEED_INFO");
  const meetingsToday = data.meetings.filter((item) => item.date === today && item.status === "SCHEDULED");
  const todayMinutes = data.sessions.reduce((sum, session) => {
    if (session.date !== today) return sum;
    if (session.status === "OPEN" && session.startedAt) {
      const started = toTimestamp(session.startedAt);
      return started ? sum + Math.max(0, Math.round((Date.now() - started) / 60000)) : sum;
    }
    return sum + (session.durationMinutes ?? 0);
  }, 0);

  return {
    kpis: {
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      workingNow: running.length,
      hoursToday: Math.round((todayMinutes / 60) * 10) / 10,
      meetingsToday: meetingsToday.length,
      pendingRequests: pendingRequests.length,
    },
    attention: buildAttention(data, overdueTasks, dueToday, pendingRequests, meetingsToday, today, clock),
    team: buildTeam(activeEmployees, data, today, clock),
    timeline: buildTimeline(data, today),
    projects: buildProjects(data, today),
    weekly: buildWeekly(data, today, thisWeekFrom, lastWeekFrom, lastWeekTo),
    departments: buildDepartments(data, today, thisWeekFrom),
    activity: data.activity.slice(0, 8),
  };
}

function buildAttention(
  data: BusinessCatalog,
  overdueTasks: Task[],
  dueToday: Task[],
  pendingRequests: LogisticsRequest[],
  meetingsToday: Meeting[],
  today: string,
  clock: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const task of overdueTasks) {
    items.push({
      id: `task-${task.id}`,
      kind: "overdue_task",
      title: task.title,
      meta: `${employeeName(data.employees, task.assigneeId)} · ${projectName(data.projects, task.projectId)}`,
      deadline: task.dueDate ? overdueLabel(task.dueDate, today) : "באיחור",
      badge: "באיחור",
      href: `/tasks?filter=overdue`,
      action: "פתח משימה",
    });
  }

  for (const task of dueToday) {
    items.push({
      id: `due-${task.id}`,
      kind: "due_today",
      title: task.title,
      meta: `${employeeName(data.employees, task.assigneeId)} · ${projectName(data.projects, task.projectId)}`,
      deadline: task.startTime ? `עד ${task.startTime}` : "דדליין היום",
      badge: "היום",
      href: `/tasks?filter=dueToday`,
      action: "פתח משימה",
    });
  }

  for (const task of data.tasks.filter((item) => isPendingApproval(item.status))) {
    items.push({
      id: `approval-${task.id}`,
      kind: "pending_request",
      title: task.title,
      meta: "משימה ממתינה לאישור",
      deadline: "ממתינה לאישור",
      badge: "לאישור",
      href: "/tasks?tab=approval",
      action: "פתח לאישור",
    });
  }

  for (const request of pendingRequests) {
    items.push({
      id: `req-${request.id}`,
      kind: "pending_request",
      title: request.title,
      meta: employeeName(data.employees, request.requestedByEmployeeId),
      deadline: "ממתינה לאישור",
      badge: "לאישור",
      href: "/requests",
      action: "פתח בקשה",
    });
  }

  for (const meeting of meetingsToday.filter((item) => !item.startTime || item.startTime >= clock)) {
    items.push({
      id: `meet-${meeting.id}`,
      kind: "upcoming_meeting",
      title: meeting.title,
      meta: meeting.participantIds.map((id) => employeeName(data.employees, id)).filter((name) => name !== "לא משויך").join(" + ") || meeting.location || "פגישה",
      deadline: meeting.startTime || "היום",
      badge: "פגישה",
      href: "/meetings",
      action: "פתח יומן",
    });
  }

  for (const project of data.projects) {
    const late = data.tasks.filter((task) => task.projectId === project.id && isOverdue(task, today)).length;
    const pastDue = Boolean(project.dueDate && project.dueDate < today && project.status === "ACTIVE");
    if (!late && !pastDue) continue;
    items.push({
      id: `proj-${project.id}`,
      kind: "project_risk",
      title: project.name,
      meta: employeeName(data.employees, project.managerEmployeeId),
      deadline: late ? `${late} משימות באיחור` : "תאריך יעד עבר",
      badge: "בסיכון",
      href: `/projects/${project.id}`,
      action: "פתח פרויקט",
    });
  }

  return items.slice(0, 10);
}

function buildTeam(employees: Employee[], data: BusinessCatalog, today: string, clock: string): TeamNowRow[] {
  const running = openSessions(data.sessions);
  return employees.map((employee) => {
    const open = running.find((session) => session.employeeId === employee.id);
    const meeting = data.meetings.find((item) => inMeetingNow(item, employee.id, today, clock));
    const closedToday = data.sessions.some((session) => session.employeeId === employee.id && session.date === today && session.status === "CLOSED");
    const status: TeamPresence = open
      ? "working"
      : meeting
        ? "meeting"
        : closedToday
          ? "finished"
          : "not_started";
    const attendance = data.sessions.find((session) =>
      session.employeeId === employee.id && session.date === today && session.status === "OPEN" && (session.kind === "ATTENDANCE" || !session.taskId),
    ) ?? open;
    const minutes = minutesToday(data.sessions, employee.id, today);
    const task = open ? data.tasks.find((item) => item.id === open.taskId) : null;
    return {
      id: employee.id,
      name: employee.displayName,
      department: departmentName(data.departments, employee.departmentId),
      initial: employee.displayName.slice(0, 1) || "?",
      status,
      currentTask: task?.title ?? (meeting ? meeting.title : null),
      timeToday: formatHours(minutes),
      clockInTime: attendance?.startTime || null,
      startedAt: attendance?.startedAt ?? null,
      hasTime: minutes > 0 || status === "working" || status === "finished",
    };
  });
}

function buildTimeline(data: BusinessCatalog, today: string): TimelineItem[] {
  return buildSchedule(data, today, "today").slice(0, 16).map((item) => ({
    id: item.id,
    time: item.time,
    title: item.title,
    meta: item.people || item.location || "",
    href: item.href,
    kind: item.kind === "meeting" ? "meeting" : item.kind === "attendance" ? "session" : "task",
  }));
}

function buildProjects(data: BusinessCatalog, today: string): ProjectHealth[] {
  return data.projects.filter((project) => project.isActive !== false).map((project) => {
    const tasks = data.tasks.filter((task) => task.projectId === project.id);
    const done = tasks.filter((task) => isDoneTaskStatus(task.status)).length;
    const overdue = tasks.filter((task) => isOverdue(task, today)).length;
    const progress = normalizeProjectProgress(project.progress);
    const pastDue = Boolean(project.dueDate && project.dueDate < today && project.status === "ACTIVE");
    const health: ProjectHealth["health"] = overdue > 0 || pastDue
      ? "risk"
      : tasks.length > 0
        ? "on_track"
        : null;
    const team = [...new Set(tasks.map((task) => task.assigneeId).filter((id): id is string => Boolean(id)))]
      .map((id) => employeeName(data.employees, id).slice(0, 1))
      .slice(0, 4);

    return {
      id: project.id,
      name: project.name,
      manager: employeeName(data.employees, project.managerEmployeeId),
      status: project.status,
      progress,
      done,
      total: tasks.length,
      overdue,
      deadline: project.dueDate,
      team,
      health,
    };
  });
}

function countCompleted(tasks: Task[], from: string, to: string) {
  return tasks.filter((task) => isDoneTaskStatus(task.status) && inRange(task.updatedAt ? isoDate(task.updatedAt) : task.dueDate, from, to)).length;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildWeekly(
  data: BusinessCatalog,
  today: string,
  thisFrom: string,
  lastFrom: string,
  lastTo: string,
): WeeklySnapshot {
  const thisSessions = data.sessions.filter((session) => inRange(session.date, thisFrom, today));
  const lastSessions = data.sessions.filter((session) => inRange(session.date, lastFrom, lastTo));
  const thisMeetings = data.meetings.filter((meeting) => inRange(meeting.date, thisFrom, today) && meeting.status !== "CANCELLED");
  const lastMeetings = data.meetings.filter((meeting) => inRange(meeting.date, lastFrom, lastTo) && meeting.status !== "CANCELLED");
  const thisNew = data.tasks.filter((task) => task.createdAt && inRange(isoDate(task.createdAt), thisFrom, today)).length;
  const lastNew = data.tasks.filter((task) => task.createdAt && inRange(isoDate(task.createdAt), lastFrom, lastTo)).length;
  const thisDone = countCompleted(data.tasks, thisFrom, today);
  const lastDone = countCompleted(data.tasks, lastFrom, lastTo);
  const thisOverdue = data.tasks.filter((task) => isOverdue(task, today)).length;
  const lastOverdue = data.tasks.filter((task) => isOverdue(task, lastTo)).length;

  return {
    hours: sessionHours(thisSessions),
    completedTasks: thisDone,
    newTasks: thisNew,
    meetings: thisMeetings.length,
    overdue: thisOverdue,
    hoursDelta: lastSessions.length ? percentChange(sessionHours(thisSessions), sessionHours(lastSessions)) : null,
    completedDelta: lastDone > 0 ? percentChange(thisDone, lastDone) : null,
    newDelta: lastNew > 0 ? percentChange(thisNew, lastNew) : null,
    meetingsDelta: lastMeetings.length ? percentChange(thisMeetings.length, lastMeetings.length) : null,
    overdueDelta: lastOverdue > 0 ? percentChange(thisOverdue, lastOverdue) : null,
  };
}

function buildDepartments(data: BusinessCatalog, today: string, weekFrom: string): DepartmentLoad[] {
  return data.departments.filter((department) => department.isActive !== false).map((department) => {
    const employees = data.employees.filter((employee) => employee.departmentId === department.id && employee.status === "ACTIVE");
    const tasks = data.tasks.filter((task) => task.departmentId === department.id);
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const hours = sessionHours(data.sessions.filter((session) => employeeIds.has(session.employeeId) && inRange(session.date, weekFrom, today)));
    return {
      id: department.id,
      name: department.name,
      employees: employees.length,
      openTasks: tasks.filter(taskIsActive).length,
      overdueTasks: tasks.filter((task) => isOverdue(task, today)).length,
      hours,
    };
  });
}

export function relativeTime(value: unknown) {
  const started = toTimestamp(value);
  if (!started) return "";
  const minutes = Math.max(0, Math.round((Date.now() - started) / 60000));
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דקות`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? "אתמול" : `לפני ${days} ימים`;
}

export function shortDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export const TEAM_STATUS_LABEL: Record<TeamPresence, string> = {
  working: "עובד עכשיו",
  meeting: "בפגישה",
  not_started: "טרם התחיל",
  finished: "סיים להיום",
};

