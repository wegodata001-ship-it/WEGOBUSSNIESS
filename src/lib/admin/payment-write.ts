import { writeActivity } from "@/lib/admin/activity";
import { writeTaskActivity } from "@/lib/admin/task-activity";
import { canReceiveTaskPayment, canSetTaskPrice, canVoidTaskPayment } from "@/lib/finance/access";
import { allocateByTaskOrder, allocationsTotal } from "@/lib/finance/allocate";
import { money, parseMoney } from "@/lib/finance/money";
import { calculateTaskPrice, DEFAULT_BUSINESS_VAT_RATE, normalizeVatRate, paymentStatusFor, remainingBalance } from "@/lib/finance/vat";
import type { ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { toTask } from "@/lib/firebase/converters";
import { businessSettingsDocPath, paymentAllocationsPath, paymentDocPath, paymentsPath, taskDocPath } from "@/lib/firebase/paths";
import { isDateOnly } from "@/lib/dates/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types/payment";

export type PaymentWriteError =
  | "FORBIDDEN"
  | "INVALID_AMOUNT"
  | "INVALID_ALLOCATION"
  | "NO_PRICE"
  | "NOT_FOUND"
  | "ALREADY_VOIDED"
  | "TASK_FIELDS";

export async function readBusinessVatRate(businessId: string) {
  const snap = await getAdminDb().doc(businessSettingsDocPath(businessId)).get();
  return normalizeVatRate(snap.data()?.vatRate, DEFAULT_BUSINESS_VAT_RATE);
}

export async function setTaskPrice(input: {
  actor: ServerActor;
  businessId: string;
  taskId: string;
  priceBeforeVat: unknown;
}) {
  if (!canSetTaskPrice(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as PaymentWriteError, status: 403 };
  }
  const db = getAdminDb();
  const ref = db.doc(taskDocPath(input.businessId, input.taskId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as PaymentWriteError, status: 404 };

  const existing = toTask(snap.id, snap.data()!);
  const price = parseMoney(input.priceBeforeVat);
  if (price === null || price < 0) {
    return { ok: false as const, error: "TASK_FIELDS" as PaymentWriteError, status: 400 };
  }

  const vatRate = existing.vatRate ?? await readBusinessVatRate(input.businessId);
  const calc = calculateTaskPrice(price, vatRate);
  const paidAmount = money(existing.paidAmount);
  const balanceDue = remainingBalance(calc.priceIncludingVat, paidAmount);
  const now = new Date();
  await ref.set({
    ...calc,
    paidAmount,
    balanceDue,
    paymentStatus: paymentStatusFor(paidAmount, calc.priceIncludingVat),
    updatedAt: now,
  }, { merge: true });
  await writeTaskActivity({
    businessId: input.businessId,
    taskId: input.taskId,
    actorUserId: input.actor.uid,
    actorEmployeeId: input.actor.employeeId,
    type: "price",
    message: "עודכן מחיר המשימה",
  });
  return { ok: true as const, id: input.taskId };
}

export async function receiveTaskPayment(input: {
  actor: ServerActor;
  businessId: string;
  taskIds: string[];
  amount: unknown;
  paymentMethod: unknown;
  paymentDate: unknown;
  reference?: unknown;
  notes?: unknown;
  allocations?: Array<{ taskId?: unknown; amount?: unknown }>;
}) {
  if (!canReceiveTaskPayment(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as PaymentWriteError, status: 403 };
  }

  const amount = parseMoney(input.amount);
  if (amount === null || amount <= 0) {
    return { ok: false as const, error: "INVALID_AMOUNT" as PaymentWriteError, status: 400 };
  }
  const method = PAYMENT_METHODS.includes(input.paymentMethod as PaymentMethod)
    ? input.paymentMethod as PaymentMethod
    : null;
  if (!method) return { ok: false as const, error: "TASK_FIELDS" as PaymentWriteError, status: 400 };
  const paymentDate = typeof input.paymentDate === "string" && isDateOnly(input.paymentDate)
    ? input.paymentDate
    : null;
  if (!paymentDate) return { ok: false as const, error: "TASK_FIELDS" as PaymentWriteError, status: 400 };

  const taskIds = [...new Set(input.taskIds.filter((id) => typeof id === "string" && id.trim()))];
  if (!taskIds.length) return { ok: false as const, error: "TASK_FIELDS" as PaymentWriteError, status: 400 };

  const db = getAdminDb();
  const snaps = await Promise.all(taskIds.map((id) => db.doc(taskDocPath(input.businessId, id)).get()));
  const tasks = snaps.map((snap) => {
    if (!snap.exists) return null;
    return toTask(snap.id, snap.data()!);
  });
  if (tasks.some((task) => !task)) {
    return { ok: false as const, error: "NOT_FOUND" as PaymentWriteError, status: 404 };
  }
  const priced = tasks.map((task) => task!);
  if (priced.some((task) => task.priceIncludingVat === null || task.balanceDue === null)) {
    return { ok: false as const, error: "NO_PRICE" as PaymentWriteError, status: 400 };
  }

  const allocatable = priced.map((task) => ({
    id: task.id,
    balanceDue: task.balanceDue ?? 0,
  }));
  const planned = input.allocations?.length
    ? input.allocations.map((item) => ({
      taskId: typeof item.taskId === "string" ? item.taskId : "",
      amount: parseMoney(item.amount) ?? 0,
    }))
    : allocateByTaskOrder(allocatable, amount).allocations;

  if (planned.some((item) => !taskIds.includes(item.taskId) || item.amount < 0)) {
    return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
  }
  if (allocationsTotal(planned) !== amount) {
    return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
  }
  for (const item of planned) {
    const task = priced.find((row) => row.id === item.taskId);
    if (!task || item.amount - 0.001 > (task.balanceDue ?? 0)) {
      return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
    }
  }

  const now = new Date();
  const paymentRef = db.collection(paymentsPath(input.businessId)).doc();
  const allocations = planned
    .filter((item) => item.amount > 0)
    .map((item) => ({ paymentId: paymentRef.id, taskId: item.taskId, amount: item.amount }));

  await paymentRef.set({
    businessId: input.businessId,
    amount,
    paymentDate,
    paymentMethod: method,
    reference: typeof input.reference === "string" ? input.reference.trim() : "",
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
    status: "RECORDED",
    allocations,
    createdByUserId: input.actor.uid,
    createdByEmployeeId: input.actor.employeeId,
    createdAt: now,
    cancelledByUserId: null,
    cancelledAt: null,
    cancelReason: null,
  });

  await Promise.all(allocations.map((item) => db.collection(paymentAllocationsPath(input.businessId)).add({
    ...item,
    businessId: input.businessId,
    status: "RECORDED",
    createdAt: now,
  })));

  for (const item of allocations) {
    const task = priced.find((row) => row.id === item.taskId)!;
    const paidAmount = money(task.paidAmount + item.amount);
    const balanceDue = remainingBalance(task.priceIncludingVat, paidAmount);
    await db.doc(taskDocPath(input.businessId, task.id)).set({
      paidAmount,
      balanceDue,
      paymentStatus: paymentStatusFor(paidAmount, task.priceIncludingVat),
      paymentIds: [...task.paymentIds, paymentRef.id],
      updatedAt: now,
    }, { merge: true });
    await writeTaskActivity({
      businessId: input.businessId,
      taskId: task.id,
      actorUserId: input.actor.uid,
      actorEmployeeId: input.actor.employeeId,
      type: "payment",
      message: `נרשם תשלום בסך ${item.amount}`,
    });
  }

  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "receivePayment",
    entityType: "payment",
    entityId: paymentRef.id,
    message: `נרשמה קבלת תשלום עבור ${allocations.length} משימות`,
  });

  return { ok: true as const, id: paymentRef.id, allocations };
}

export async function voidTaskPayment(input: {
  actor: ServerActor;
  businessId: string;
  paymentId: string;
  reason?: string;
}) {
  if (!canVoidTaskPayment(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as PaymentWriteError, status: 403 };
  }
  const db = getAdminDb();
  const ref = db.doc(paymentDocPath(input.businessId, input.paymentId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as PaymentWriteError, status: 404 };
  const data = snap.data()!;
  if (data.status === "VOIDED") {
    return { ok: false as const, error: "ALREADY_VOIDED" as PaymentWriteError, status: 400 };
  }
  const now = new Date();
  const allocations = Array.isArray(data.allocations) ? data.allocations as Array<{ taskId: string; amount: number }> : [];
  await ref.set({
    status: "VOIDED",
    cancelledByUserId: input.actor.uid,
    cancelledAt: now,
    cancelReason: input.reason?.trim() || "ביטול תשלום",
    updatedAt: now,
  }, { merge: true });

  const allocSnap = await db.collection(paymentAllocationsPath(input.businessId)).where("paymentId", "==", input.paymentId).get();
  await Promise.all(allocSnap.docs.map((docSnap) => docSnap.ref.set({ status: "VOIDED", cancelledAt: now }, { merge: true })));

  for (const item of allocations) {
    const taskRef = db.doc(taskDocPath(input.businessId, item.taskId));
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) continue;
    const task = toTask(taskSnap.id, taskSnap.data()!);
    const paidAmount = money(Math.max(0, task.paidAmount - item.amount));
    await taskRef.set({
      paidAmount,
      balanceDue: remainingBalance(task.priceIncludingVat, paidAmount),
      paymentStatus: paymentStatusFor(paidAmount, task.priceIncludingVat),
      updatedAt: now,
    }, { merge: true });
    await writeTaskActivity({
      businessId: input.businessId,
      taskId: task.id,
      actorUserId: input.actor.uid,
      actorEmployeeId: input.actor.employeeId,
      type: "payment_void",
      message: "בוטל תשלום שנרשם בטעות",
    });
  }

  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "voidPayment",
    entityType: "payment",
    entityId: input.paymentId,
    message: input.reason?.trim() || "בוטל תשלום",
  });
  return { ok: true as const, id: input.paymentId };
}
