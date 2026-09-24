import type { DocumentData, Timestamp } from "firebase/firestore";
import type { CatalogSetting, CatalogSettingType } from "@/types/catalog-setting";
import { CATALOG_SETTING_TYPES } from "@/types/catalog-setting";
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
import { BUSINESS_ROLES, resolveLocale } from "@/types/roles";
import { asCalendarColor, asTaskKind } from "@/lib/admin/palette";
import { normalizeTaskTeam } from "@/lib/admin/task-team";
import type { PaymentMethod, PaymentRecord, PaymentRecordStatus, TaskPaymentStatus } from "@/types/payment";
import { PAYMENT_METHODS, PAYMENT_RECORD_STATUSES, TASK_PAYMENT_STATUSES } from "@/types/payment";
import type { Task, TaskActivity, TaskComment, TaskPriority, TaskStatus } from "@/types/task";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import type { AppUser } from "@/types/user";
import type { WorkSession, WorkSessionKind, WorkSessionStatus } from "@/types/work-hours";
import { WORK_SESSION_KINDS, WORK_SESSION_STATUSES } from "@/types/work-hours";
import { REQUEST_STATUSES } from "@/types/logistics";
import { MEETING_STATUSES, MEETING_TYPES } from "@/types/meeting";
import { dateTimeInZone, toSafeDate, zonedDateTime } from "@/lib/admin/meeting-time";
import { DEFAULT_TIMEZONE } from "@/lib/env";
import { DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import { normalizeProjectProgress } from "@/lib/admin/project-progress";
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
  return resolveLocale(value);
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
    legacyId: asNullableString(data.legacyId),
    name: asString(data.name),
    clientName: asString(data.clientName),
    description: asString(data.description),
    status: asOneOf<ProjectStatus>(data.status, PROJECT_STATUSES, "ACTIVE"),
    category: asNullableString(data.category),
    location: asNullableString(data.location),
    projectNumber: asNullableString(data.projectNumber),
    departmentId: asNullableString(data.departmentId),
    managerEmployeeId: asNullableString(data.managerEmployeeId),
    startDate: asNullableString(data.startDate),
    dueDate: asNullableString(data.dueDate),
    progress: normalizeProjectProgress(data.progress),
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
    createdByEmployeeId: asNullableString(data.createdByEmployeeId),
    approvedByUserId: asNullableString(data.approvedByUserId),
    approvedAt: toDate(data.approvedAt),
    rejectedByUserId: asNullableString(data.rejectedByUserId),
    rejectedAt: toDate(data.rejectedAt),
    rejectionReason: asNullableString(data.rejectionReason),
    commentCount: asNumber(data.commentCount, 0) ?? 0,
    priceBeforeVat: asNumber(data.priceBeforeVat),
    vatRate: asNumber(data.vatRate),
    vatAmount: asNumber(data.vatAmount),
    priceIncludingVat: asNumber(data.priceIncludingVat),
    paidAmount: asNumber(data.paidAmount, 0) ?? 0,
    balanceDue: asNumber(data.balanceDue),
    paymentStatus: data.paymentStatus && TASK_PAYMENT_STATUSES.includes(data.paymentStatus as TaskPaymentStatus)
      ? data.paymentStatus as TaskPaymentStatus
      : null,
    paymentIds: asStringArray(data.paymentIds),
    legacyId: asNullableString(data.legacyId),
    legacyProjectId: asNullableString(data.legacyProjectId),
    legacyAssignee: asNullableString(data.legacyAssignee),
    legacyCreatorEmail: asNullableString(data.legacyCreatorEmail),
    legacyApprovalStatus: data.legacyApprovalStatus === "PENDING" || data.legacyApprovalStatus === "APPROVED"
      ? data.legacyApprovalStatus
      : null,
    legacyStatus: asNullableString(data.legacyStatus),
    legacyPriority: asNullableString(data.legacyPriority),
    legacyCategory: asNullableString(data.legacyCategory),
    completedDate: asNullableString(data.completedDate),
    recurrence: asNullableString(data.recurrence),
    isSent: data.isSent == null ? null : data.isSent === true,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toTaskComment(id: string, data: DocumentData): TaskComment {
  const attachments = Array.isArray(data.attachments)
    ? data.attachments
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        name: typeof item.name === "string" ? item.name : "",
        url: typeof item.url === "string" ? item.url : null,
      }))
      .filter((item) => item.name)
    : [];
  return {
    id,
    businessId: asString(data.businessId),
    taskId: asString(data.taskId),
    authorUserId: asString(data.authorUserId),
    authorEmployeeId: asNullableString(data.authorEmployeeId),
    body: asString(data.body),
    mentions: asStringArray(data.mentions),
    attachments,
    legacyId: asNullableString(data.legacyId),
    legacyAuthorEmail: asNullableString(data.legacyAuthorEmail),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toTaskActivity(id: string, data: DocumentData): TaskActivity {
  return {
    id,
    businessId: asString(data.businessId),
    taskId: asString(data.taskId),
    actorUserId: asString(data.actorUserId),
    actorEmployeeId: asNullableString(data.actorEmployeeId),
    type: asString(data.type) || asString(data.action) || "update",
    message: asString(data.message),
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
    createdByEmployeeId: asNullableString(data.createdByEmployeeId),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((item) => item.trim()))];
}

export function toWorkSession(id: string, data: DocumentData): WorkSession {
  const taskId = asNullableString(data.taskId);
  return {
    id,
    businessId: asString(data.businessId),
    employeeId: asString(data.employeeId),
    userId: asString(data.userId),
    taskId,
    kind: asOneOf<WorkSessionKind>(data.kind, WORK_SESSION_KINDS, taskId ? "TASK" : "ATTENDANCE"),
    date: asString(data.date),
    startTime: asString(data.startTime),
    endTime: asNullableString(data.endTime),
    startedAt: toDate(data.startedAt),
    endedAt: toDate(data.endedAt),
    durationMinutes: asNumber(data.durationMinutes),
    status: asOneOf<WorkSessionStatus>(data.status, WORK_SESSION_STATUSES, "OPEN"),
    note: asNullableString(data.note),
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
    type: asString(data.type) || "general",
    title: asString(data.title),
    body: asString(data.body),
    href: asNullableString(data.href),
    entityType: asNullableString(data.entityType),
    entityId: asNullableString(data.entityId),
    isRead: asBoolean(data.isRead ?? data.read),
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

export function toCatalogSetting(id: string, data: DocumentData): CatalogSetting | null {
  const type = data.type as CatalogSettingType;
  if (!CATALOG_SETTING_TYPES.includes(type)) return null;
  return {
    id,
    businessId: asString(data.businessId),
    legacyId: asNullableString(data.legacyId) ?? id,
    type,
    value: asString(data.value),
    color: asString(data.color) || "#64748b",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function toBusinessSettings(id: string, data: DocumentData): BusinessSettings {
  return {
    id,
    businessId: asString(data.businessId),
    allowEmployeeSelfRequests: data.allowEmployeeSelfRequests !== false,
    workWeekStart: asNumber(data.workWeekStart, 0) ?? 0,
    vatRate: asNumber(data.vatRate, DEFAULT_BUSINESS_VAT_RATE) ?? DEFAULT_BUSINESS_VAT_RATE,
    updatedAt: toDate(data.updatedAt),
  };
}

export function toPaymentRecord(id: string, data: DocumentData): PaymentRecord {
  const allocations = Array.isArray(data.allocations)
    ? data.allocations
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        paymentId: typeof item.paymentId === "string" ? item.paymentId : id,
        taskId: typeof item.taskId === "string" ? item.taskId : "",
        amount: typeof item.amount === "number" ? item.amount : 0,
      }))
      .filter((item) => item.taskId)
    : [];
  return {
    id,
    businessId: asString(data.businessId),
    amount: asNumber(data.amount, 0) ?? 0,
    paymentDate: asString(data.paymentDate),
    paymentMethod: asOneOf<PaymentMethod>(data.paymentMethod, PAYMENT_METHODS, "OTHER"),
    reference: asString(data.reference),
    notes: asString(data.notes),
    status: asOneOf<PaymentRecordStatus>(data.status, PAYMENT_RECORD_STATUSES, "RECORDED"),
    allocations,
    createdByUserId: asString(data.createdByUserId),
    createdByEmployeeId: asNullableString(data.createdByEmployeeId),
    createdAt: toDate(data.createdAt),
    cancelledByUserId: asNullableString(data.cancelledByUserId),
    cancelledAt: toDate(data.cancelledAt),
    cancelReason: asNullableString(data.cancelReason),
  };
}
