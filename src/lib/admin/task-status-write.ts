import { actorCan, type ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { toTaskStatusDefinition } from "@/lib/firebase/converters";
import { taskStatusDocPath, taskStatusesPath } from "@/lib/firebase/paths";
import { CALENDAR_COLORS, type CalendarColor } from "@/lib/admin/palette";
import {
  DEFAULT_TASK_STATUS_SEEDS,
  TASK_STATUS_TYPES,
  type TaskStatusDefinition,
  type TaskStatusType,
} from "@/types/task-status";

export function canManageTaskStatuses(actor: ServerActor) {
  return actor.isOwnerOrManager || actorCan(actor, "settings.manage") || actorCan(actor, "departments.manage");
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function ensureDefaultTaskStatuses(businessId: string) {
  const db = getAdminDb();
  const snap = await db.collection(taskStatusesPath(businessId)).get();
  if (!snap.empty) {
    return snap.docs
      .map((docSnap) => toTaskStatusDefinition(docSnap.id, docSnap.data()))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }
  const now = new Date();
  await Promise.all(DEFAULT_TASK_STATUS_SEEDS.map((item) => db.doc(taskStatusDocPath(businessId, item.id)).set({
    businessId,
    name: item.name,
    nameAr: item.nameAr,
    color: item.color,
    type: item.type,
    sortOrder: item.sortOrder,
    isActive: true,
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  })));
  return DEFAULT_TASK_STATUS_SEEDS.map((item) => ({
    ...item,
    businessId,
    isActive: true,
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  } satisfies TaskStatusDefinition));
}

export async function upsertTaskStatus(input: {
  actor: ServerActor;
  businessId: string;
  id?: string;
  data: Record<string, unknown>;
}) {
  if (!canManageTaskStatuses(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }
  const name = text(input.data.name);
  if (!name) return { ok: false as const, error: "NAME_REQUIRED", status: 400 };
  const type = TASK_STATUS_TYPES.includes(input.data.type as TaskStatusType)
    ? input.data.type as TaskStatusType
    : "TODO";
  const color = CALENDAR_COLORS.includes(input.data.color as CalendarColor)
    ? input.data.color as CalendarColor
    : "BLUE";
  const db = getAdminDb();
  const now = new Date();
  const existing = input.id ? await db.doc(taskStatusDocPath(input.businessId, input.id)).get() : null;
  if (input.id && !existing?.exists) return { ok: false as const, error: "NOT_FOUND", status: 404 };
  const system = existing?.data()?.isSystem === true;
  const sortOrder = typeof input.data.sortOrder === "number" && Number.isFinite(input.data.sortOrder)
    ? input.data.sortOrder
    : (existing?.data()?.sortOrder as number | undefined) ?? Date.now();
  const ref = input.id
    ? db.doc(taskStatusDocPath(input.businessId, input.id))
    : db.collection(taskStatusesPath(input.businessId)).doc();
  await ref.set({
    businessId: input.businessId,
    name,
    nameAr: text(input.data.nameAr),
    color,
    type: system ? (existing?.data()?.type ?? type) : type,
    sortOrder,
    isActive: input.data.isActive === false ? false : true,
    isSystem: system,
    updatedAt: now,
    ...(input.id ? {} : { createdAt: now }),
  }, { merge: true });
  return { ok: true as const, id: ref.id };
}

export async function reorderTaskStatuses(input: {
  actor: ServerActor;
  businessId: string;
  ids: string[];
}) {
  if (!canManageTaskStatuses(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }
  const db = getAdminDb();
  const now = new Date();
  await Promise.all(input.ids.map((id, index) => db.doc(taskStatusDocPath(input.businessId, id)).set({
    sortOrder: (index + 1) * 10,
    updatedAt: now,
  }, { merge: true })));
  return { ok: true as const };
}
