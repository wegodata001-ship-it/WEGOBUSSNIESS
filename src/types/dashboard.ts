export type DashboardKpis = {
  activeTasks: number;
  overdueTasks: number;
  activeEmployees: number;
  monthWorkHours: number;
  upcomingMeetings: number;
  pendingRequests: number;
};

export const EMPTY_DASHBOARD_KPIS: DashboardKpis = {
  activeTasks: 0,
  overdueTasks: 0,
  activeEmployees: 0,
  monthWorkHours: 0,
  upcomingMeetings: 0,
  pendingRequests: 0,
};

export type DashboardListKind = "tasks" | "meetings" | "requests" | "activity";
