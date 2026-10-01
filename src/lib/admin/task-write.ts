import { notifyEmployees, notifyManagers, notifyUnpaidOnComplete, notifyUsers, taskHref } from "@/lib/admin/notify";
import { canSetTaskPrice } from "@/lib/finance/access";
import { parseMoney } from "@/lib/finance/money";
import { calculateTaskPrice, DEFAULT_BUSINESS_VAT_RATE, paymentStatusFor, remainingBalance } from "@/lib/finance/vat";
import { writeTaskActivity } from "@/lib/admin/task-activity";
import { canChangeWorkStatus } from "@/lib/admin/task-access";
import { normalizeTaskTeam, taskParticipantIds } from "@/lib/admin/task-team";
import { actorCan, type ServerActor } from "@/lib/auth/server-actor";
import { isDateOnly, isTimeOnly } from "@/lib/dates/format";
import { getAdminDb } from "@/lib/firebase/admin";
import { ensureTaskTemplate } from "@/lib/admin/task-template-write";
import { isCompletedTaskStatus } from "@/lib/admin/project-progress";
import { syncProjectProgressFromTasks } from "@/lib/admin/project-progress-sync";
import { canonicalTaskStatus, taskCompletionPatch } from "@/lib/admin/task-completion";
import { departmentDocPath, employeeDocPath, projectDocPath, taskDocPath, tasksPath } from "@/lib/firebase/paths";
import { isPendingApproval, type TaskStatus } from "@/types/task";

export type TaskWriteError = "FORBIDDEN" | "TASK_FIELDS" | "MISSING_ID" | "NOT_FOUND" | "INVALID_PROJECT" | "INVALID_DEPARTMENT";

export type TaskWriteResult =
  | { ok: true; id: string }
  | { ok: false; error: TaskWriteError; status: number };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: unknown) {
  const next = text(value);
  return next || null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateOrNull(value: unknown) {
  const next = nullable(value);
  return next && isDateOnly(next) ? next : null;
}

function timeOrNull(value: unknown) {
  const next = nullable(value);
  return next && isTimeOnly(next) ? next : null;
}

export function canCreateTask(actor: ServerActor) {
  return actorCan(actor, "tasks.create") || actorCan(actor, "tasks.edit") || actor.isOwnerOrManager;
}

export function canManageTasks(actor: ServerActor) {
  return actorCan(actor, "tasks.edit") || actor.isOwnerOrManager;
}

export function canEditTaskDoc(actor: ServerActor, existing: { createdByUserId?: unknown; status?: unknown }) {
  if (canManageTasks(actor)) return true;
  if (text(existing.createdByUserId) !== actor.uid) return false;
  return isPendingApproval(text(existing.status) as TaskStatus) || !existing.status;
}

export async function upsertTask(input: {
  actor: ServerActor;
  businessId: string;
  taskId?: string;
  data: Record<string, unknown>;
}): Promise<TaskWriteResult> {
  const { actor, businessId, data } = input;
  const isUpdate = Boolean(input.taskId);
  const db = getAdminDb();
  const now = new Date();

  if (!isUpdate && !canCreateTask(actor)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }

  const existingSnap = isUpdate ? await db.doc(taskDocPath(businessId, input.taskId!)).get() : null;
  if (isUpdate && !existingSnap?.exists) {
    return { ok: false, error: "NOT_FOUND", status: 404 };
  }
  const existing = existingSnap?.data() ?? {};
  if (isUpdate && !canEditTaskDoc(actor, existing)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }

  const projectId = nullable(data.projectId);
  if (projectId) {
    const project = await db.doc(projectDocPath(businessId, projectId)).get();
    if (!project.exists) return { ok: false, error: "INVALID_PROJECT", status: 400 };
  }
  const departmentId = nullable(data.departmentId);
  if (departmentId) {
    const department = await db.doc(departmentDocPath(businessId, departmentId)).get();
    if (!department.exists) return { ok: false, error: "INVALID_DEPARTMENT", status: 400 };
  }

  const canAssignTeam = canManageTasks(actor) || !isUpdate;
  const existingTeam = normalizeTaskTeam(existing);
  const incomingTeam = normalizeTaskTeam({
    assigneeId: data.assigneeId,
    collaboratorIds: data.collaboratorIds,
    assigneeEmployeeId: data.assigneeEmployeeId,
    assigneeEmployeeIds: data.assigneeEmployeeIds,
    participantIds: data.participantIds,
  });
  const team = canAssignTeam ? incomingTeam : existingTeam;
  if (!isUpdate && !team.assigneeId && actor.employeeId) {
    team.assigneeId = actor.employeeId;
    team.collaboratorIds = team.collaboratorIds.filter((id) => id !== actor.employeeId);
  }

  const participantIds = team.assigneeId ? [team.assigneeId, ...team.collaboratorIds] : team.collaboratorIds;
  for (const employeeId of participantIds) {
    const employee = await db.doc(employeeDocPath(businessId, employeeId)).get();
    if (!employee.exists) return { ok: false, error: "TASK_FIELDS", status: 400 };
  }

  const title = text(data.title);
  if (!title) return { ok: false, error: "TASK_FIELDS", status: 400 };

  let templateId = nullable(data.templateId);
  if (data.saveToLibrary === true) {
    templateId = await ensureTaskTemplate({
      businessId,
      title,
      description: text(data.libraryDescription ?? data.description),
      taskType: text(data.taskType) || text(data.type) || "GENERAL",
      departmentId,
    });
  }

  const requestedStatus = text(data.status);
  const existingStatus = text(existing.status);
  let status: TaskStatus;
  if (!isUpdate) {
    status = canManageTasks(actor) ? "TODO" : "PENDING_APPROVAL";
  } else if (!canManageTasks(actor) && isPendingApproval(existingStatus as TaskStatus)) {
    status = "PENDING_APPROVAL";
  } else if (requestedStatus && canManageTasks(actor)) {
    status = (requestedStatus === "DONE" ? "COMPLETED" : requestedStatus) as TaskStatus;
  } else {
    status = (existingStatus || "TODO") as TaskStatus;
  }

  const completion = taskCompletionPatch({
    previousStatus: existingStatus,
    nextStatus: status,
    actorUserId: actor.uid,
    now,
  });

  const payload = {
    businessId,
    title,
    description: text(data.description),
    ...completion,
    priority: text(data.priority) === "MEDIUM" ? "NORMAL" : text(data.priority) || "NORMAL",
    assigneeId: team.assigneeId,
    collaboratorIds: team.collaboratorIds,
    assigneeEmployeeId: team.assigneeId,
    assigneeEmployeeIds: participantIds,
    participantIds,
    departmentId,
    projectId,
    estimatedHours: numberOrNull(data.estimatedHours),
    startDate: dateOrNull(data.startDate),
    dueDate: dateOrNull(data.dueDate),
    scheduledDate: dateOrNull(data.scheduledDate) ?? dateOrNull(data.startDate),
    startTime: timeOrNull(data.startTime),
    endTime: timeOrNull(data.endTime),
    color: text(data.color) || "BLUE",
    taskType: text(data.taskType) || text(data.type) || "GENERAL",
    statusId: nullable(data.statusId) ?? (typeof existing.statusId === "string" ? existing.statusId : status),
    templateId,
    createdByEmployeeId: isUpdate
      ? (typeof existing.createdByEmployeeId === "string" ? existing.createdByEmployeeId : actor.employeeId)
      : actor.employeeId,
    updatedAt: now,
    ...(canSetTaskPrice(actor) && data.priceBeforeVat !== undefined ? (() => {
      const price = parseMoney(data.priceBeforeVat);
      if (price === null || price < 0) return {};
      const vatRate = typeof existing.vatRate === "number" ? existing.vatRate : DEFAULT_BUSINESS_VAT_RATE;
      const calc = calculateTaskPrice(price, vatRate);
      const paidAmount = typeof existing.paidAmount === "number" ? existing.paidAmount : 0;
      return {
        ...calc,
        paidAmount,
        balanceDue: remainingBalance(calc.priceIncludingVat, paidAmount),
        paymentStatus: paymentStatusFor(paidAmount, calc.priceIncludingVat),
      };
    })() : {}),
  };

  const ref = isUpdate
    ? db.doc(taskDocPath(businessId, input.taskId!))
    : db.collection(tasksPath(businessId)).doc();

  await ref.set(isUpdate
    ? payload
    : {
      ...payload,
      seedKey: null,
      actualHours: null,
      commentCount: 0,
      createdByUserId: actor.uid,
      approvedByUserId: null,
      approvedAt: null,
      rejectedByUserId: null,
      rejectedAt: null,
      rejectionReason: null,
      createdAt: now,
    }, { merge: true });

  const previousProjectId = typeof existing.projectId === "string" ? existing.projectId : null;
  await syncProjectProgressFromTasks(businessId, projectId);
  if (previousProjectId && previousProjectId !== projectId) {
    await syncProjectProgressFromTasks(businessId, previousProjectId);
  }

  const previousIds = new Set(taskParticipantIds({
    assigneeId: existingTeam.assigneeId,
    collaboratorIds: existingTeam.collaboratorIds,
  }));
  const addedIds = participantIds.filter((id) => !previousIds.has(id));
  const removedIds = [...previousIds].filter((id) => !participantIds.includes(id));
  const href = taskHref(ref.id);

  const projectName = projectId
    ? text((await db.doc(projectDocPath(businessId, projectId)).get()).data()?.name)
    : "";
  const taskRows = [
    { label: "משימה", value: title },
    { label: "פרויקט", value: projectName },
    { label: "דדליין", value: dateOrNull(data.dueDate) || dateOrNull(data.scheduledDate) || "" },
    { label: "שעה", value: timeOrNull(data.startTime) || "" },
    { label: "עדיפות", value: text(data.priority) || "NORMAL" },
  ];

  if (!isUpdate && canManageTasks(actor)) {
    await notifyEmployees({
      businessId,
      employeeIds: participantIds,
      skipUserIds: [actor.uid],
      title: "הוקצתה לך משימה חדשה",
      body: title,
      href,
      type: "task.assigned",
      entityType: "task",
      entityId: ref.id,
      subject: "WEGO BIZ — משימה חדשה הוקצתה לך",
      rows: taskRows,
      dedupeKey: `TASK_ASSIGNED:${ref.id}:${participantIds.join(",")}`,
    });
    await notifyManagers({
      businessId,
      skipUserIds: [actor.uid],
      title: "משימה חדשה נוצרה",
      body: title,
      href,
      type: "task.created",
      entityType: "task",
      entityId: ref.id,
      rows: taskRows,
      dedupeKey: `TASK_CREATED:${ref.id}`,
    });
    await writeTaskActivity({
      businessId,
      taskId: ref.id,
      actorUserId: actor.uid,
      actorEmployeeId: actor.employeeId,
      type: "created",
      message: "יצר/ה את המשימה",
    });
  } else if (!isUpdate) {
    await notifyManagers({
      businessId,
      skipUserIds: [actor.uid],
      title: "משימה ממתינה לאישור",
      body: title,
      href,
      type: "task.submitted",
      entityType: "task",
      entityId: ref.id,
    });
    await writeTaskActivity({
      businessId,
      taskId: ref.id,
      actorUserId: actor.uid,
      actorEmployeeId: actor.employeeId,
      type: "created",
      message: "יצר/ה את המשימה",
    });
    await writeTaskActivity({
      businessId,
      taskId: ref.id,
      actorUserId: actor.uid,
      actorEmployeeId: actor.employeeId,
      type: "submitted",
      message: "המשימה נשלחה לאישור",
    });
  } else {
    if (addedIds.length && !isPendingApproval(status)) {
      await notifyEmployees({
        businessId,
        employeeIds: addedIds,
        skipUserIds: [actor.uid],
        title: "משימה חדשה הוקצתה לך",
        body: title,
        href,
        type: "task.assigned",
        entityType: "task",
        entityId: ref.id,
        subject: "WEGO BIZ — משימה חדשה הוקצתה לך",
        rows: taskRows,
        dedupeKey: `TASK_ASSIGNED:${ref.id}:${addedIds.join(",")}`,
      });
    }
    if (removedIds.length) {
      await notifyEmployees({
        businessId,
        employeeIds: removedIds,
        skipUserIds: [actor.uid],
        title: "המשימה הוסרה מהעבודה שלך",
        body: title,
        href,
        type: "task.removed",
        entityType: "task",
        entityId: ref.id,
        dedupeKey: `TASK_REMOVED:${ref.id}:${removedIds.join(",")}`,
      });
    }
    const significant = dateOrNull(data.dueDate) !== (typeof existing.dueDate === "string" ? existing.dueDate : null)
      || timeOrNull(data.startTime) !== (typeof existing.startTime === "string" ? existing.startTime : null)
      || projectId !== (typeof existing.projectId === "string" ? existing.projectId : null)
      || (text(data.priority) || "NORMAL") !== (text(existing.priority) || "NORMAL");
    const remaining = participantIds.filter((id) => !addedIds.includes(id));
    if (significant && remaining.length && canManageTasks(actor)) {
      await notifyEmployees({
        businessId,
        employeeIds: remaining,
        skipUserIds: [actor.uid],
        title: "המשימה שלך עודכנה",
        body: title,
        href,
        type: "task.updated",
        entityType: "task",
        entityId: ref.id,
        rows: taskRows,
        dedupeKey: `TASK_UPDATED:${ref.id}:${now.toISOString().slice(0, 13)}`,
      });
    }
    await writeTaskActivity({
      businessId,
      taskId: ref.id,
      actorUserId: actor.uid,
      actorEmployeeId: actor.employeeId,
      type: "updated",
      message: "עודכנה המשימה",
    });
  }

  return { ok: true, id: ref.id };
}

export async function decideTask(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  action: "approve" | "reject";
  reason?: string;
  data?: Record<string, unknown>;
}): Promise<TaskWriteResult> {
  if (!canManageTasks(input.actor)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  if (input.action === "approve" && input.data) {
    const updated = await upsertTask({
      actor: input.actor,
      businessId: input.businessId,
      taskId: input.taskId,
      data: { ...input.data, status: "TODO" },
    });
    if (!updated.ok) return updated;
  }

  const db = getAdminDb();
  const ref = db.doc(taskDocPath(input.businessId, input.taskId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "NOT_FOUND", status: 404 };
  const existing = snap.data() ?? {};
  const now = new Date();
  const title = text(existing.title);
  const creatorUserId = text(existing.createdByUserId);
  const participants = taskParticipantIds(existing);

  if (input.action === "approve") {
    await ref.set({
      status: "TODO",
      approvedByUserId: input.actor.uid,
      approvedAt: now,
      rejectedByUserId: null,
      rejectedAt: null,
      rejectionReason: null,
      updatedAt: now,
    }, { merge: true });
    await writeTaskActivity({
      businessId: input.businessId,
      taskId: input.taskId,
      actorUserId: input.actor.uid,
      actorEmployeeId: input.actor.employeeId,
      type: "approved",
      message: "אישר/ה את המשימה",
    });
    await notifyEmployees({
      businessId: input.businessId,
      employeeIds: participants,
      skipUserIds: [input.actor.uid],
      title: "המשימה אושרה",
      body: title,
      href: taskHref(input.taskId),
      type: "task.approved",
      entityType: "task",
      entityId: input.taskId,
      channels: { inApp: true, email: false },
      dedupeKey: `TASK_APPROVED:${input.taskId}`,
    });
    if (creatorUserId && creatorUserId !== input.actor.uid) {
      await notifyUsers({
        businessId: input.businessId,
        userIds: [creatorUserId],
        skipUserIds: [input.actor.uid],
        title: "המשימה אושרה",
        body: title,
        href: taskHref(input.taskId),
        type: "task.approved",
        entityType: "task",
        entityId: input.taskId,
        channels: { inApp: true, email: false },
      });
    }
  } else {
    await ref.set({
      status: "REJECTED",
      rejectedByUserId: input.actor.uid,
      rejectedAt: now,
      rejectionReason: text(input.reason) || null,
      approvedByUserId: null,
      approvedAt: null,
      updatedAt: now,
    }, { merge: true });
    await writeTaskActivity({
      businessId: input.businessId,
      taskId: input.taskId,
      actorUserId: input.actor.uid,
      actorEmployeeId: input.actor.employeeId,
      type: "rejected",
      message: text(input.reason) ? `דחה/תה את המשימה: ${text(input.reason)}` : "דחה/תה את המשימה",
    });
    if (creatorUserId) {
      await notifyUsers({
        businessId: input.businessId,
        userIds: [creatorUserId],
        skipUserIds: [input.actor.uid],
        title: "המשימה הוחזרה לתיקון",
        body: text(input.reason) ? `${title}\n${text(input.reason)}` : title,
        href: taskHref(input.taskId),
        type: "task.rejected",
        entityType: "task",
        entityId: input.taskId,
        channels: { inApp: true, email: true },
        dedupeKey: `TASK_REJECTED:${input.taskId}`,
      });
    }
  }

  return { ok: true, id: input.taskId };
}

const EMPLOYEE_STATUSES = new Set(["TODO", "IN_PROGRESS", "WAITING", "COMPLETED", "DONE"]);

export async function changeTaskWorkStatus(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  status: string;
  statusId?: string | null;
}): Promise<TaskWriteResult> {
  const db = getAdminDb();
  const ref = db.doc(taskDocPath(input.businessId, input.taskId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "NOT_FOUND", status: 404 };
  const existing = snap.data() ?? {};
  if (!canChangeWorkStatus(input.actor, {
    createdByUserId: text(existing.createdByUserId),
    assigneeId: typeof existing.assigneeId === "string" ? existing.assigneeId : null,
    collaboratorIds: Array.isArray(existing.collaboratorIds) ? existing.collaboratorIds : [],
    participantIds: Array.isArray(existing.participantIds) ? existing.participantIds : [],
  })) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  if (isPendingApproval(text(existing.status) as TaskStatus) || text(existing.status) === "REJECTED") {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  const next = canonicalTaskStatus(input.status);
  if (!canManageTasks(input.actor) && !EMPLOYEE_STATUSES.has(next)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  if (next === "CANCELLED" && !canManageTasks(input.actor)) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  const now = new Date();
  const completion = taskCompletionPatch({
    previousStatus: text(existing.status),
    nextStatus: next,
    actorUserId: input.actor.uid,
    now,
  });
  await ref.set({
    ...completion,
    statusId: input.statusId === undefined ? (typeof existing.statusId === "string" ? existing.statusId : next) : (input.statusId || next),
    updatedAt: now,
  }, { merge: true });
  await syncProjectProgressFromTasks(input.businessId, typeof existing.projectId === "string" ? existing.projectId : null);
  const wasDone = isCompletedTaskStatus(text(existing.status));
  if (!wasDone && isCompletedTaskStatus(next)) {
    await notifyManagers({
      businessId: input.businessId,
      skipUserIds: [input.actor.uid],
      title: `✓ הושלמה: ${text(existing.title)}`,
      body: text(existing.title),
      href: taskHref(input.taskId),
      type: "task.completed",
      entityType: "task",
      entityId: input.taskId,
      channels: { inApp: true, email: false },
      dedupeKey: `TASK_COMPLETED:${input.taskId}`,
    });
    const priceIncludingVat = typeof existing.priceIncludingVat === "number" ? existing.priceIncludingVat : null;
    const paidAmount = typeof existing.paidAmount === "number" ? existing.paidAmount : 0;
    await notifyUnpaidOnComplete({
      businessId: input.businessId,
      taskId: input.taskId,
      title: text(existing.title),
      balanceDue: remainingBalance(priceIncludingVat, paidAmount),
      skipUserId: input.actor.uid,
    });
  }
  await writeTaskActivity({
    businessId: input.businessId,
    taskId: input.taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: "status",
    message: `שינה/תה סטטוס ל"${next === "COMPLETED" ? "הושלמה" : next === "IN_PROGRESS" ? "בביצוע" : next === "WAITING" ? "בהמתנה" : "לביצוע"}"`,
  });
  return { ok: true, id: input.taskId };
}

export async function updateTaskWork(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  data: {
    scheduledDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    description?: string;
    status?: string;
  };
}): Promise<TaskWriteResult> {
  const db = getAdminDb();
  const ref = db.doc(taskDocPath(input.businessId, input.taskId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "NOT_FOUND", status: 404 };
  const existing = snap.data() ?? {};
  if (!canChangeWorkStatus(input.actor, {
    createdByUserId: text(existing.createdByUserId),
    assigneeId: typeof existing.assigneeId === "string" ? existing.assigneeId : null,
    collaboratorIds: Array.isArray(existing.collaboratorIds) ? existing.collaboratorIds : [],
    participantIds: Array.isArray(existing.participantIds) ? existing.participantIds : [],
  })) {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }
  if (isPendingApproval(text(existing.status) as TaskStatus) || text(existing.status) === "REJECTED") {
    return { ok: false, error: "FORBIDDEN", status: 403 };
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.data.scheduledDate !== undefined) patch.scheduledDate = dateOrNull(input.data.scheduledDate);
  if (input.data.startTime !== undefined) patch.startTime = timeOrNull(input.data.startTime);
  if (input.data.endTime !== undefined) patch.endTime = timeOrNull(input.data.endTime);
  if (input.data.description !== undefined) patch.description = text(input.data.description);
  if (input.data.status) {
    const next = canonicalTaskStatus(input.data.status);
    if (!canManageTasks(input.actor) && !EMPLOYEE_STATUSES.has(next)) {
      return { ok: false, error: "FORBIDDEN", status: 403 };
    }
    Object.assign(patch, taskCompletionPatch({
      previousStatus: text(existing.status),
      nextStatus: next,
      actorUserId: input.actor.uid,
      now: new Date(),
    }));
  }

  await ref.set(patch, { merge: true });
  if (input.data.status) {
    await syncProjectProgressFromTasks(input.businessId, typeof existing.projectId === "string" ? existing.projectId : null);
  }
  await writeTaskActivity({
    businessId: input.businessId,
    taskId: input.taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: input.data.status ? "status" : "update",
    message: input.data.scheduledDate ? `העביר/ה משימה ל-${input.data.scheduledDate}` : "עדכן/ה את יום העבודה",
  });
  return { ok: true, id: input.taskId };
}
