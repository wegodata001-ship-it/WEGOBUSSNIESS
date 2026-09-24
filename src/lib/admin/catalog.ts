"use client";

import { useCallback, useEffect, useState } from "react";
import { listAllActivity } from "@/lib/data/activity";
import { listBusinessDepartments } from "@/lib/data/departments";
import { listDocuments } from "@/lib/data/documents";
import { listCatalogSettings } from "@/lib/data/catalog-settings";
import { listBusinessSettings } from "@/lib/data/settings";
import { listBusinessEmployees } from "@/lib/data/employees";
import { listBusinessMeetings } from "@/lib/data/meetings";
import { listBusinessMembers } from "@/lib/data/members";
import { listProjects } from "@/lib/data/projects";
import { listBusinessRequests } from "@/lib/data/requests";
import { listBusinessTasks } from "@/lib/data/tasks";
import { listWorkSessions } from "@/lib/data/work-hours";
import type { CatalogSetting } from "@/types/catalog-setting";
import type { ActivityLog, BusinessSettings } from "@/types/notification";
import { DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import type { Department, Project } from "@/types/department";
import type { BusinessDocument } from "@/types/document";
import type { Employee } from "@/types/employee";
import type { LogisticsRequest } from "@/types/logistics";
import type { Meeting } from "@/types/meeting";
import type { Membership } from "@/types/membership";
import type { Task } from "@/types/task";
import type { WorkSession } from "@/types/work-hours";

export type BusinessCatalog = {
  tasks: Task[];
  employees: Employee[];
  departments: Department[];
  members: Membership[];
  sessions: WorkSession[];
  meetings: Meeting[];
  requests: LogisticsRequest[];
  activity: ActivityLog[];
  projects: Project[];
  documents: BusinessDocument[];
  settings: BusinessSettings;
  catalog: CatalogSetting[];
};

const EMPTY: BusinessCatalog = {
  tasks: [],
  employees: [],
  departments: [],
  members: [],
  sessions: [],
  meetings: [],
  requests: [],
  activity: [],
  projects: [],
  documents: [],
  settings: {
    id: "general",
    businessId: "",
    allowEmployeeSelfRequests: true,
    workWeekStart: 0,
    vatRate: DEFAULT_BUSINESS_VAT_RATE,
    updatedAt: null,
  },
  catalog: [],
};

export function useBusinessCatalog(businessId: string | null) {
  const [data, setData] = useState<BusinessCatalog>(EMPTY);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (options?: { silent?: boolean } | unknown) => {
    if (!businessId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    const silent = Boolean(options && typeof options === "object" && "silent" in options && (options as { silent?: boolean }).silent);
    if (!silent) setLoading(true);
    const [tasks, employees, departments, members, sessions, meetings, requests, activity, projects, documents, settings, catalog] =
      await Promise.all([
        listBusinessTasks(businessId, { viewAll: true }),
        listBusinessEmployees(businessId),
        listBusinessDepartments(businessId),
        listBusinessMembers(businessId),
        listWorkSessions(businessId, { viewAll: true }),
        listBusinessMeetings(businessId),
        listBusinessRequests(businessId),
        listAllActivity(businessId),
        listProjects(businessId),
        listDocuments(businessId),
        listBusinessSettings(businessId),
        listCatalogSettings(businessId),
      ]);
    setData({
      tasks: tasks.data,
      employees: employees.data,
      departments: departments.data,
      members: members.data,
      sessions: sessions.data,
      meetings: meetings.data,
      requests: requests.data,
      activity: activity.data,
      projects: projects.data,
      documents: documents.data,
      settings: settings.data,
      catalog: catalog.data,
    });
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, reload };
}

export function employeeName(employees: Employee[], id: string | null | undefined) {
  if (!id) return "לא משויך";
  return employees.find((item) => item.id === id)?.displayName ?? "לא משויך";
}

export function departmentName(departments: Department[], id: string | null | undefined) {
  if (!id) return "ללא מחלקה";
  return departments.find((item) => item.id === id)?.name ?? "ללא מחלקה";
}

export function projectName(projects: Project[], id: string | null | undefined) {
  if (!id) return "ללא פרויקט";
  return projects.find((item) => item.id === id)?.name ?? "ללא פרויקט";
}

export function sessionHours(sessions: WorkSession[]) {
  return Math.round((sessions.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0) / 60) * 10) / 10;
}
