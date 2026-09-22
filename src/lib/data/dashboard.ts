import { listRecentActivity } from "@/lib/data/activity";
import { listBusinessEmployees } from "@/lib/data/employees";
import { listUpcomingMeetings } from "@/lib/data/meetings";
import { listPendingRequests } from "@/lib/data/requests";
import { listBusinessTasks } from "@/lib/data/tasks";
import { listWorkSessions } from "@/lib/data/work-hours";
import { readyResult, waitingResult, type DataResult } from "@/lib/data/result";
import { WAITING_FOR_FIREBASE_CONFIG } from "@/lib/env";
import { hasPermission } from "@/lib/permissions/engine";
import { EMPTY_DASHBOARD_KPIS, type DashboardKpis } from "@/types/dashboard";
import type { ActivityLog } from "@/types/notification";
import type { LogisticsRequest } from "@/types/logistics";
import type { Meeting } from "@/types/meeting";
import type { Permission } from "@/types/permissions";
import { ACTIVE_TASK_STATUSES, isDoneTaskStatus, isArchivedTaskStatus, type Task } from "@/types/task";

export type DashboardSnapshot = {
  kpis: DashboardKpis;
  myTasksToday: Task[];
  upcomingMeetings: Meeting[];
  pendingRequests: LogisticsRequest[];
  recentActivity: ActivityLog[];
};

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  kpis: EMPTY_DASHBOARD_KPIS,
  myTasksToday: [],
  upcomingMeetings: [],
  pendingRequests: [],
  recentActivity: [],
};

export async function loadDashboardSnapshot(
  businessId: string | null,
  today: string,
  monthPrefix: string,
  options: {
    employeeId?: string | null;
    permissions: readonly Permission[];
    viewAll: boolean;
  },
): Promise<DataResult<DashboardSnapshot>> {
  if (!businessId) {
    return readyResult(EMPTY_SNAPSHOT);
  }

  const canViewAllTasks = options.viewAll || hasPermission(options.permissions, "tasks.viewAll");
  const [tasks, employees, meetings, requests, activity, sessions] = await Promise.all([
    listBusinessTasks(businessId, {
      viewAll: canViewAllTasks,
      assigneeEmployeeId: options.employeeId,
    }),
    hasPermission(options.permissions, "employees.view")
      ? listBusinessEmployees(businessId)
      : Promise.resolve({ status: "READY" as const, data: [] }),
    hasPermission(options.permissions, "meetings.view")
      ? listUpcomingMeetings(businessId, today)
      : Promise.resolve({ status: "READY" as const, data: [] }),
    hasPermission(options.permissions, "logistics.viewAll") || hasPermission(options.permissions, "logistics.viewOwn")
      ? listPendingRequests(businessId)
      : Promise.resolve({ status: "READY" as const, data: [] }),
    hasPermission(options.permissions, "activityLogs.view")
      ? listRecentActivity(businessId)
      : Promise.resolve({ status: "READY" as const, data: [] }),
    listWorkSessions(businessId, {
      viewAll: hasPermission(options.permissions, "workHours.viewAll"),
      employeeId: options.employeeId,
    }),
  ]);

  if (tasks.status === WAITING_FOR_FIREBASE_CONFIG) {
    return waitingResult(EMPTY_SNAPSHOT);
  }

  const monthMinutes = sessions.data
    .filter((session) => session.date.startsWith(monthPrefix) && session.durationMinutes)
    .reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);

  const activeTasks = tasks.data.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status));
  const overdueTasks = tasks.data.filter((task) =>
    Boolean(task.dueDate) && task.dueDate! < today && !isDoneTaskStatus(task.status) && !isArchivedTaskStatus(task.status),
  );
  const myTasksToday = tasks.data.filter((task) =>
    task.scheduledDate === today || task.startDate === today || task.dueDate === today,
  );

  return readyResult({
    kpis: {
      activeTasks: activeTasks.length,
      overdueTasks: overdueTasks.length,
      activeEmployees: employees.data.filter((employee) => employee.status === "ACTIVE").length,
      monthWorkHours: Math.round((monthMinutes / 60) * 10) / 10,
      upcomingMeetings: meetings.data.length,
      pendingRequests: requests.data.length,
    },
    myTasksToday,
    upcomingMeetings: meetings.data.slice(0, 6),
    pendingRequests: requests.data.slice(0, 6),
    recentActivity: activity.data,
  });
}
