import type { DocumentData, Timestamp } from "firebase/firestore";
import type { ActivityLog, AppNotification, BusinessSettings } from "@/types/notification";
import type { Business } from "@/types/business";
import type { Department, Project, ProjectStatus } from "@/types/department";
import type { BusinessDocument, DocumentCategory } from "@/types/document";
import { DOCUMENT_CATEGORIES } from "@/types/document";
import { PROJECT_STATUSES } from "@/types/department";
import type { Employee, EmployeeStatus } from "@/types/employee";
import type { LogisticsRequest, RequestStatus, RequestType } from "@/types/logistics";
import { REQUEST_TYPES } from "@/types/logistics";
import type { Meeting, MeetingStatus, MeetingType } from "@/types/meeting";
import type { Membership } from "@/types/membership";
import type { Permission } from "@/types/permissions";
import { PERMISSIONS } from "@/types/permissions";
import type { BusinessRole, Locale, PlatformRole } from "@/types/roles";
import { BUSINESS_ROLES, LOCALES } from "@/types/roles";
import { asCalendarColor, asTaskKind } from "@/lib/admin/palette";
import { normalizeTaskTeam } from "@/lib/admin/task-team";
import type { Task, TaskComment, TaskPriority, TaskStatus } from "@/types/task";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import type { AppUser } from "@/types/user";
import type { WorkSession, WorkSessionStatus } from "@/types/work-hours";
import { WORK_SESSION_STATUSES } from "@/types/work-hours";
import { REQUEST_STATUSES } from "@/types/logistics";
import { MEETING_STATUSES, MEETING_TYPES } from "@/types/meeting";
import { dateTimeInZone, toSafeDate, zonedDateTime } from "@/lib/admin/meeting-time";
import { DEFAULT_TIMEZONE } from "@/lib/env";
import { isDateOnly, isTimeOnly } from "@/lib/dates/format";
import { EMPLOYEE_STATUSES } from "@/types/employee";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as Timestamp).toDate();
  }
  return null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number | null = null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asLocale(value: unknown): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : "he";
}

function asRole(value: unknown): BusinessRole {
  return BUSINESS_ROLES.includes(value as BusinessRole)
    ? (value as BusinessRole)
    : "EMPLOYEE";
}

function asPermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Permission =>
    PERMISSIONS.includes(item as Permission),
  );
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function toAppUser(id: string, data: DocumentData): AppUser {
  const platformRole = data.platformRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : null;

  return {
    id,
    email: asString(data.email),
    displayName: asString(data.displayName),
    phone: asNullableString(data.phone),
    photoUrl: asNullableString(data.photoUrl),
    platformRole: platformRole as PlatformRole,
    defaultBusinessId: asNullableString(data.defaultBusinessId),
    locale: asLocale(data.locale),
    isActive: data.isActive !== false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toBusiness(id: string, data: DocumentData): Business {
  return {
    id,
    name: asString(data.name),
    slug: asString(data.slug),
    logoUrl: asNullableString(data.logoUrl),
    primaryColor: asString(data.primaryColor, "#2563eb"),
    secondaryColor: asString(data.secondaryColor, "#0f766e"),
    language: asLocale(data.language),
    timezone: asString(data.timezone, "Asia/Jerusalem"),
    status: data.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
    ownerUserId: asString(data.ownerUserId),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toMembership(data: DocumentData, businessId = ""): Membership {
  return {
    userId: asString(data.userId),
    businessId: asString(data.businessId, businessId),
    employeeId: asNullableString(data.employeeId),
    role: asRole(data.role),
    permissions: asPermissions(data.permissions),
    email: asNullableString(data.email),
    displayName: asNullableString(data.displayName),
    isActive: data.isActive !== false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toEmployee(id: string, data: DocumentData): Employee {
  return {
    id,
    businessId: asString(data.businessId),
    userId: asNullableString(data.userId),
    firstName: asString(data.firstName),
    lastName: asString(data.lastName),
    displayName: asString(data.displayName, `${asString(data.firstName)} ${asString(data.lastName)}`.trim()),
    email: asNullableString(data.email),
    phone: asNullableString(data.phone),
    departmentId: asNullableString(data.departmentId),
    jobTitle: asNullableString(data.jobTitle),
    status: asOneOf<EmployeeStatus>(data.status, EMPLOYEE_STATUSES, "ACTIVE"),
    startDate: asNullableString(data.startDate),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toDepartment(id: string, data: DocumentData): Department {
  return {
    id,
    businessId: asString(data.businessId),
    name: asString(data.name),
    slug: asString(data.slug),
    managerEmployeeId: asNullableString(data.managerEmployeeId),
    isActive: data.isActive !== false,
    description: asString(data.description),
    color: asCalendarColor(data.color),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toProject(id: string, data: DocumentData): Project {
  return {
    id,
    businessId: asString(data.businessId),
    seedKey: asNullableString(data.seedKey),
    name: asString(data.name),
    clientName: asString(data.clientName),
    description: asString(data.description),
    status: asOneOf<ProjectStatus>(data.status, PROJECT_STATUSES, "ACTIVE"),
    departmentId: asNullableString(data.departmentId),
    managerEmployeeId: asNullableString(data.managerEmployeeId),
    startDate: asNullableString(data.startDate),
    dueDate: asNullableString(data.dueDate),
    isActive: data.isActive !== false,
    color: asCalendarColor(data.color),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toTask(id: string, data: DocumentData): Task {
  const team = normalizeTaskTeam(data);
  return {
    id,
    businessId: asString(data.businessId),
    seedKey: asNullableString(data.seedKey),
    title: asString(data.title),
    description: asString(data.description),
    status: asOneOf<TaskStatus>(data.status, TASK_STATUSES, "TODO"),
    priority: asOneOf<TaskPriority>(data.priority === "MEDIUM" ? "NORMAL" : data.priority, TASK_PRIORITIES, "NORMAL"),
    color: asCalendarColor(data.color),
    taskType: asTaskKind(data.taskType ?? data.type),
    assigneeId: team.assigneeId,
    collaboratorIds: team.collaboratorIds,
    assigneeEmployeeId: team.assigneeId,
    assigneeEmployeeIds: team.assigneeId ? [team.assigneeId, ...team.collaboratorIds] : team.collaboratorIds,
    departmentId: asNullableString(data.departmentId),
    projectId: asNullableString(data.projectId),
    estimatedHours: asNumber(data.estimatedHours),
    actualHours: asNumber(data.actualHours),
    startDate: asNullableString(data.startDate),
    dueDate: asNullableString(data.dueDate),
    scheduledDate: asNullableString(data.scheduledDate),
    startTime: asNullableString(data.startTime),
    endTime: asNullableString(data.endTime),
    startAt: toSafeDate(data.startAt),
    endAt: toSafeDate(data.endAt),
    createdByUserId: asString(data.createdByUserId),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toTaskComment(id: string, data: DocumentData): TaskComment {
  return {
    id,
    businessId: asString(data.businessId),
    taskId: asString(data.taskId),
    authorUserId: asString(data.authorUserId),
    body: asString(data.body),
    createdAt: toDate(data.createdAt),
  };
}

export function toMeeting(id: string, data: DocumentData): Meeting {
  const startAt = toSafeDate(data.startAt);
  const endAt = toSafeDate(data.endAt);
  const startParts = startAt ? dateTimeInZone(startAt, DEFAULT_TIMEZONE) : null;
  const endParts = endAt ? dateTimeInZone(endAt, DEFAULT_TIMEZONE) : null;
  const legacyDate = isDateOnly(asString(data.date)) ? asString(data.date) : "";
  const legacyStart = isTimeOnly(asString(data.startTime)) ? asString(data.startTime) : "";
  const legacyEnd = isTimeOnly(asString(data.endTime)) ? asString(data.endTime) : "";
  const date = startParts?.date || legacyDate;
  const startTime = startParts?.time || legacyStart;
  const endTime = endParts?.time || legacyEnd || null;
  const composedStart = startAt ?? (date && startTime ? zonedDateTime(date, startTime, DEFAULT_TIMEZONE) : null);
  const composedEnd = endAt ?? (date && endTime ? zonedDateTime(date, endTime, DEFAULT_TIMEZONE) : null);
  const participants = uniqueStrings([
    ...asStringArray(data.participantIds),
    ...asStringArray(data.participantEmployeeIds),
  ]);
  const createdBy = asString(data.createdBy) || asString(data.createdByUserId);

  return {
    id,
    businessId: asString(data.businessId),
    title: asString(data.title),
    description: asString(data.description) || asString(data.notes),
    notes: asString(data.notes) || asString(data.description),
    status: asOneOf<MeetingStatus>(
      data.status === "DONE" ? "COMPLETED" : data.status,
      MEETING_STATUSES,
      "SCHEDULED",
    ),
    startAt: composedStart,
    endAt: composedEnd,
    date,
    startTime,
    endTime,
    location: asNullableString(data.location),
    meetingType: asOneOf<MeetingType>(data.meetingType, MEETING_TYPES, "OTHER"),
    color: asCalendarColor(data.color),
    projectId: asNullableString(data.projectId),
    participantIds: participants,
    participantEmployeeIds: participants,
    createdBy,
    createdByUserId: createdBy,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((item) => item.trim()))];
}

export function toWorkSession(id: string, data: DocumentData): WorkSession {
  return {
    id,
    businessId: asString(data.businessId),
    employeeId: asString(data.employeeId),
    userId: asString(data.userId),
    taskId: asNullableString(data.taskId),
    date: asString(data.date),
    startTime: asString(data.startTime),
    endTime: asNullableString(data.endTime),
    startedAt: toDate(data.startedAt),
    endedAt: toDate(data.endedAt),
    durationMinutes: asNumber(data.durationMinutes),
    status: asOneOf<WorkSessionStatus>(data.status, WORK_SESSION_STATUSES, "OPEN"),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toLogisticsRequest(id: string, data: DocumentData): LogisticsRequest {
  return {
    id,
    businessId: asString(data.businessId),
    title: asString(data.title),
    details: asString(data.details),
    type: asOneOf<RequestType>(data.type, REQUEST_TYPES, "OTHER"),
    status: asOneOf<RequestStatus>(data.status, REQUEST_STATUSES, "PENDING"),
    amount: asNumber(data.amount),
    fileUrl: asNullableString(data.fileUrl),
    requestedByEmployeeId: asString(data.requestedByEmployeeId),
    requestedByUserId: asString(data.requestedByUserId),
    reviewedByUserId: asNullableString(data.reviewedByUserId),
    managerResponse: asString(data.managerResponse),
    handledBy: asNullableString(data.handledBy),
    handledAt: toDate(data.handledAt),
    requestDate: asNullableString(data.requestDate) ?? asNullableString(data.date),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toBusinessDocument(id: string, data: DocumentData): BusinessDocument {
  return {
    id,
    businessId: asString(data.businessId),
    name: asString(data.name),
    fileName: asString(data.fileName),
    contentType: asString(data.contentType, "application/octet-stream"),
    size: asNumber(data.size, 0) ?? 0,
    storagePath: asString(data.storagePath),
    url: asNullableString(data.url),
    projectId: asNullableString(data.projectId),
    clientName: asString(data.clientName),
    category: asOneOf<DocumentCategory>(data.category, DOCUMENT_CATEGORIES, "OTHER"),
    note: asString(data.note),
    uploadedByUserId: asString(data.uploadedByUserId),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toNotification(id: string, data: DocumentData): AppNotification {
  return {
    id,
    businessId: asString(data.businessId),
    userId: asString(data.userId),
    title: asString(data.title),
    body: asString(data.body),
    href: asNullableString(data.href),
    isRead: asBoolean(data.isRead),
    createdAt: toDate(data.createdAt),
  };
}

export function toActivityLog(id: string, data: DocumentData): ActivityLog {
  return {
    id,
    businessId: asString(data.businessId),
    actorUserId: asString(data.actorUserId),
    action: asString(data.action),
    entityType: asString(data.entityType),
    entityId: asNullableString(data.entityId),
    message: asString(data.message),
    createdAt: toDate(data.createdAt),
  };
}

export function toBusinessSettings(id: string, data: DocumentData): BusinessSettings {
  return {
    id,
    businessId: asString(data.businessId),
    allowEmployeeSelfRequests: data.allowEmployeeSelfRequests !== false,
    workWeekStart: asNumber(data.workWeekStart, 0) ?? 0,
    updatedAt: toDate(data.updatedAt),
  };
}
