import { writeActivity } from "@/lib/admin/activity";
import { canReceiveTaskPayment, canViewTaskFinance } from "@/lib/finance/access";
import { money, parseMoney } from "@/lib/finance/money";
import { isDateOnly } from "@/lib/dates/format";
import type { ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { movementDocPath, movementsPath } from "@/lib/firebase/paths";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types/payment";
import { MOVEMENT_TYPES, type MovementType } from "@/types/movement";

export function canManageMovements(actor: ServerActor) {
  return canReceiveTaskPayment(actor);
}

export function canViewMovements(actor: ServerActor) {
  return canViewTaskFinance(actor);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function createMoneyMovement(input: {
  actor: ServerActor;
  businessId: string;
  type: unknown;
  amount: unknown;
  date: unknown;
  clientId?: unknown;
  clientName?: unknown;
  projectId?: unknown;
  taskIds?: unknown;
  paymentId?: string | null;
  paymentMethod?: unknown;
  description?: unknown;
  note?: unknown;
}) {
  if (!canManageMovements(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }
  const type = MOVEMENT_TYPES.includes(input.type as MovementType) ? input.type as MovementType : null;
  const amount = parseMoney(input.amount);
  const date = typeof input.date === "string" && isDateOnly(input.date) ? input.date : null;
  if (!type || amount === null || amount <= 0 || !date) {
    return { ok: false as const, error: "INVALID_AMOUNT", status: 400 };
  }
  const method = input.paymentMethod
    ? (PAYMENT_METHODS.includes(input.paymentMethod as PaymentMethod) ? input.paymentMethod as PaymentMethod : null)
    : null;
  const db = getAdminDb();
  const now = new Date();
  const ref = db.collection(movementsPath(input.businessId)).doc();
  const taskIds = Array.isArray(input.taskIds)
    ? input.taskIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : [];
  await ref.set({
    businessId: input.businessId,
    type,
    amount: money(amount),
    date,
    clientId: text(input.clientId) || null,
    clientName: text(input.clientName),
    projectId: text(input.projectId) || null,
    taskIds,
    paymentId: input.paymentId ?? null,
    paymentMethod: method,
    description: text(input.description),
    note: text(input.note),
    status: "RECORDED",
    createdByUserId: input.actor.uid,
    createdByEmployeeId: input.actor.employeeId,
    createdAt: now,
    updatedAt: now,
  });
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "createMovement",
    entityType: "movement",
    entityId: ref.id,
    message: type === "INCOME" ? "נרשמה תנועת הכנסה" : "נרשמה תנועת הוצאה",
  });
  return { ok: true as const, id: ref.id };
}

export async function voidMoneyMovementByPayment(input: {
  businessId: string;
  paymentId: string;
}) {
  const db = getAdminDb();
  const snap = await db.collection(movementsPath(input.businessId)).where("paymentId", "==", input.paymentId).get();
  const now = new Date();
  await Promise.all(snap.docs.map((docSnap) => docSnap.ref.set({
    status: "VOIDED",
    updatedAt: now,
  }, { merge: true })));
}

export async function voidMoneyMovement(input: {
  actor: ServerActor;
  businessId: string;
  movementId: string;
}) {
  if (!canManageMovements(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN", status: 403 };
  }
  const db = getAdminDb();
  const ref = db.doc(movementDocPath(input.businessId, input.movementId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND", status: 404 };
  if (snap.data()?.paymentId) {
    return { ok: false as const, error: "LINKED_PAYMENT", status: 400 };
  }
  await ref.set({ status: "VOIDED", updatedAt: new Date() }, { merge: true });
  return { ok: true as const, id: input.movementId };
}
