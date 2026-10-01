"use client";

import { useCallback, useEffect, useState } from "react";
import { listAllActivity } from "@/lib/data/activity";
import { listDepartmentCategories } from "@/lib/data/department-categories";
import { listBusinessDepartments } from "@/lib/data/departments";
import { listBusinessDocs, listServiceItems, listTermsTemplates } from "@/lib/data/business-docs";
import { listBusinessClients } from "@/lib/data/clients";
import { listDocuments } from "@/lib/data/documents";
import { listCatalogSettings } from "@/lib/data/catalog-settings";
import { listBusinessSettings } from "@/lib/data/settings";
import { listBusinessEmployees } from "@/lib/data/employees";
import { listBusinessMeetings } from "@/lib/data/meetings";
import { listBusinessMembers } from "@/lib/data/members";
import { listProjects } from "@/lib/data/projects";
import { listBusinessRequests } from "@/lib/data/requests";
import { listTaskTemplates } from "@/lib/data/task-templates";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listMoneyMovements } from "@/lib/data/movements";
import { listBusinessTasks } from "@/lib/data/tasks";
import { listWorkSessions } from "@/lib/data/work-hours";
import { getI18nLocale, translate } from "@/lib/i18n";
import type { BusinessDocumentRecord, ServiceItem, TermsTemplate } from "@/types/business-doc";
import type { BusinessClient } from "@/types/client";
import type { CatalogSetting } from "@/types/catalog-setting";
import type { ActivityLog, BusinessSettings } from "@/types/notification";
import { DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import type { Department, DepartmentCategory, Project } from "@/types/department";
import type { BusinessDocument } from "@/types/document";
import type { Employee } from "@/types/employee";
import type { LogisticsRequest } from "@/types/logistics";
import type { Meeting } from "@/types/meeting";
import type { Membership } from "@/types/membership";
import type { MoneyMovement } from "@/types/movement";
import type { Task } from "@/types/task";
import type { TaskStatusDefinition } from "@/types/task-status";
import type { TaskTemplate } from "@/types/task-template";
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
  businessDocs: BusinessDocumentRecord[];
  clients: BusinessClient[];
  termsTemplates: TermsTemplate[];
  serviceItems: ServiceItem[];
  settings: BusinessSettings;
  catalog: CatalogSetting[];
  departmentCategories: DepartmentCategory[];
  taskTemplates: TaskTemplate[];
  taskStatuses: TaskStatusDefinition[];
  movements: MoneyMovement[];
  projectsError: string | null;
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
  businessDocs: [],
  clients: [],
  termsTemplates: [],
  serviceItems: [],
  settings: {
    id: "general",
    businessId: "",
    allowEmployeeSelfRequests: true,
    workWeekStart: 0,
    vatRate: DEFAULT_BUSINESS_VAT_RATE,
    legalType: "",
    customBusinessType: "",
    taxId: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    about: "",
    services: [],
    logoUrl: null,
    logoStoragePath: null,
    updatedAt: null,
  },
  catalog: [],
  departmentCategories: [],
  taskTemplates: [],
  taskStatuses: [],
  movements: [],
  projectsError: null,
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
    const [tasks, employees, departments, members, sessions, meetings, requests, activity, projects, documents, settings, catalog, departmentCategories, businessDocs, clients, termsTemplates, serviceItems, taskTemplates, taskStatuses, movements] =
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
        listDepartmentCategories(businessId),
        listBusinessDocs(businessId),
        listBusinessClients(businessId),
        listTermsTemplates(businessId),
        listServiceItems(businessId),
        listTaskTemplates(businessId),
        listTaskStatuses(businessId),
        listMoneyMovements(businessId),
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
      businessDocs: businessDocs.data,
      clients: clients.data,
      termsTemplates: termsTemplates.data,
      serviceItems: serviceItems.data,
      settings: settings.data,
      catalog: catalog.data,
      departmentCategories: departmentCategories.data,
      taskTemplates: taskTemplates.data,
      taskStatuses: taskStatuses.data,
      movements: movements.data,
      projectsError: projects.error ?? null,
    });
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, reload };
}

export function employeeName(employees: Employee[], id: string | null | undefined) {
  if (!id) return translate(getI18nLocale(), "common.unassigned");
  return employees.find((item) => item.id === id)?.displayName ?? translate(getI18nLocale(), "common.unassigned");
}

export function departmentName(departments: Department[], id: string | null | undefined) {
  if (!id) return translate(getI18nLocale(), "common.noDepartment");
  return departments.find((item) => item.id === id)?.name ?? translate(getI18nLocale(), "common.noDepartment");
}

export function projectName(projects: Project[], id: string | null | undefined) {
  if (!id) return translate(getI18nLocale(), "common.noProject");
  return projects.find((item) => item.id === id)?.name ?? translate(getI18nLocale(), "common.noProject");
}

export function sessionHours(sessions: WorkSession[]) {
  return Math.round((sessions.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0) / 60) * 10) / 10;
}
