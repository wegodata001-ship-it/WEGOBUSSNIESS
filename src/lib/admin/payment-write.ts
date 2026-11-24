import { writeActivity } from "@/lib/admin/activity";
import { createMoneyMovement, voidMoneyMovementByPayment } from "@/lib/admin/movement-write";
import { writeTaskActivity } from "@/lib/admin/task-activity";
import { canReceiveTaskPayment, canSetTaskPrice, canVoidTaskPayment } from "@/lib/finance/access";
import { allocateByTaskOrder, allocationsTotal } from "@/lib/finance/allocate";
import { isBillableFinanceTask } from "@/lib/finance/project-ledger";
import { money, parseMoney } from "@/lib/finance/money";
import { calculateTaskPrice, DEFAULT_BUSINESS_VAT_RATE, normalizeVatRate, paymentStatusFor, remainingBalance } from "@/lib/finance/vat";
import type { ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { toProject, toTask } from "@/lib/firebase/converters";
import { businessSettingsDocPath, paymentAllocationsPath, paymentDocPath, paymentsPath, projectDocPath, taskDocPath } from "@/lib/firebase/paths";
import { isDateOnly } from "@/lib/dates/format";
import { PAYMENT_METHODS, type PaymentAllocation, type PaymentMethod } from "@/types/payment";

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
    billingMode: "BILLABLE",
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
  taskIds?: string[];
  projectId?: string | null;
  amount: unknown;
  paymentMethod: unknown;
  paymentDate: unknown;
  reference?: unknown;
  notes?: unknown;
  allocations?: Array<{
    taskId?: unknown;
    projectId?: unknown;
    target?: unknown;
    amount?: unknown;
  }>;
  /** When true, allow paying more than current balances (credit). */
  allowOverpay?: boolean;
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

  const projectId = typeof input.projectId === "string" && input.projectId.trim()
    ? input.projectId.trim()
    : null;
  const taskIds = [...new Set((input.taskIds ?? []).filter((id) => typeof id === "string" && id.trim()))];
  if (!taskIds.length && !projectId) {
    return { ok: false as const, error: "TASK_FIELDS" as PaymentWriteError, status: 400 };
  }

  const db = getAdminDb();
  const projectSnap = projectId ? await db.doc(projectDocPath(input.businessId, projectId)).get() : null;
  if (projectId && !projectSnap?.exists) {
    return { ok: false as const, error: "NOT_FOUND" as PaymentWriteError, status: 404 };
  }
  const project = projectSnap?.exists ? toProject(projectSnap.id, projectSnap.data()!) : null;

  const snaps = await Promise.all(taskIds.map((id) => db.doc(taskDocPath(input.businessId, id)).get()));
  const tasks = snaps.map((snap) => (snap.exists ? toTask(snap.id, snap.data()!) : null));
  if (tasks.some((task) => !task)) {
    return { ok: false as const, error: "NOT_FOUND" as PaymentWriteError, status: 404 };
  }
  const priced = tasks.map((task) => task!);
  if (priced.some((task) => !isBillableFinanceTask(task) || task.balanceDue === null)) {
    return { ok: false as const, error: "NO_PRICE" as PaymentWriteError, status: 400 };
  }

  type Planned = { target: "TASK" | "PROJECT_BASE"; taskId: string | null; projectId: string | null; amount: number };
  let planned: Planned[] = [];

  if (input.allocations?.length) {
    planned = input.allocations.map((item) => {
      const allocAmount = parseMoney(item.amount) ?? 0;
      const target = item.target === "PROJECT_BASE" || (!item.taskId && (item.projectId || projectId))
        ? "PROJECT_BASE" as const
        : "TASK" as const;
      return {
        target,
        taskId: target === "TASK" && typeof item.taskId === "string" ? item.taskId : null,
        projectId: target === "PROJECT_BASE"
          ? (typeof item.projectId === "string" && item.projectId ? item.projectId : projectId)
          : projectId,
        amount: allocAmount,
      };
    });
  } else if (projectId && !taskIds.length) {
    planned = [{ target: "PROJECT_BASE", taskId: null, projectId, amount }];
  } else if (projectId && taskIds.length) {
    const baseBalance = project?.baseBalanceDue ?? (project?.basePriceIncludingVat != null
      ? remainingBalance(project.basePriceIncludingVat, project.basePaidAmount ?? 0)
      : 0) ?? 0;
    let left = amount;
    const toBase = money(Math.min(left, Math.max(0, baseBalance)));
    left = money(left - toBase);
    planned = [];
    if (toBase > 0) planned.push({ target: "PROJECT_BASE", taskId: null, projectId, amount: toBase });
    if (left > 0) {
      const taskPlan = allocateByTaskOrder(
        priced.map((task) => ({ id: task.id, balanceDue: task.balanceDue ?? 0 })),
        left,
      ).allocations;
      for (const row of taskPlan) {
        if (row.amount > 0) {
          planned.push({ target: "TASK", taskId: row.taskId, projectId, amount: row.amount });
        }
      }
      const allocatedTasks = money(taskPlan.reduce((sum, row) => sum + row.amount, 0));
      const leftover = money(left - allocatedTasks);
      if (leftover > 0 && input.allowOverpay !== false) {
        // Overpay lands on project base as credit capacity.
        const existing = planned.find((row) => row.target === "PROJECT_BASE");
        if (existing) existing.amount = money(existing.amount + leftover);
        else planned.push({ target: "PROJECT_BASE", taskId: null, projectId, amount: leftover });
      }
    }
  } else {
    const taskPlan = allocateByTaskOrder(
      priced.map((task) => ({ id: task.id, balanceDue: task.balanceDue ?? 0 })),
      amount,
    ).allocations;
    planned = taskPlan
      .filter((row) => row.amount > 0)
      .map((row) => ({
        target: "TASK" as const,
        taskId: row.taskId,
        projectId: priced.find((task) => task.id === row.taskId)?.projectId ?? null,
        amount: row.amount,
      }));
  }

  if (planned.some((item) => item.amount < 0)) {
    return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
  }
  if (allocationsTotal(planned.map((item) => ({ taskId: item.taskId ?? item.projectId ?? "", amount: item.amount }))) !== amount) {
    return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
  }

  for (const item of planned) {
    if (item.target === "TASK") {
      if (!item.taskId || !taskIds.includes(item.taskId)) {
        return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
      }
      const task = priced.find((row) => row.id === item.taskId);
      if (!task) return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
      if (input.allowOverpay === false && item.amount - 0.001 > (task.balanceDue ?? 0)) {
        return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
      }
    } else {
      if (!item.projectId || item.projectId !== projectId || !project) {
        return { ok: false as const, error: "INVALID_ALLOCATION" as PaymentWriteError, status: 400 };
      }
    }
  }

  const now = new Date();
  const paymentRef = db.collection(paymentsPath(input.businessId)).doc();
  const allocations: PaymentAllocation[] = planned
    .filter((item) => item.amount > 0)
    .map((item) => ({
      paymentId: paymentRef.id,
      target: item.target,
      taskId: item.taskId,
      projectId: item.projectId,
      amount: item.amount,
    }));

  await paymentRef.set({
    businessId: input.businessId,
    amount,
    paymentDate,
    paymentMethod: method,
    reference: typeof input.reference === "string" ? input.reference.trim() : "",
    notes: typeof input.notes === "string" ? input.notes.trim() : "",
    status: "RECORDED",
    projectId,
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
    if (item.target === "TASK" && item.taskId) {
      const task = priced.find((row) => row.id === item.taskId)!;
      const paidAmount = money(task.paidAmount + item.amount);
      const balanceDue = remainingBalance(task.priceIncludingVat, paidAmount);
      await db.doc(taskDocPath(input.businessId, task.id)).set({
        paidAmount,
        balanceDue,
        paymentStatus: paymentStatusFor(paidAmount, task.priceIncludingVat),
        paymentIds: [...new Set([...task.paymentIds, paymentRef.id])],
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
    } else if (item.target === "PROJECT_BASE" && item.projectId && project) {
      const paidAmount = money((project.basePaidAmount ?? 0) + item.amount);
      const price = project.basePriceIncludingVat;
      await db.doc(projectDocPath(input.businessId, item.projectId)).set({
        basePaidAmount: paidAmount,
        baseBalanceDue: remainingBalance(price, paidAmount),
        basePaymentStatus: paymentStatusFor(paidAmount, price),
        paymentIds: [...new Set([...(project.paymentIds ?? []), paymentRef.id])],
        updatedAt: now,
      }, { merge: true });
      // Keep in-memory project paid for multi-line PROJECT_BASE (rare).
      project.basePaidAmount = paidAmount;
    }
  }

  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "receivePayment",
    entityType: "payment",
    entityId: paymentRef.id,
    message: projectId
      ? `נרשמה קבלת תשלום לפרויקט`
      : `נרשמה קבלת תשלום עבור ${allocations.filter((row) => row.target === "TASK").length} משימות`,
  });

  const { notifyManagers } = await import("@/lib/admin/notify");
  await notifyManagers({
    businessId: input.businessId,
    skipUserIds: [input.actor.uid],
    title: "תשלום התקבל",
    body: `התקבל תשלום בסך ${amount.toLocaleString("he-IL")} ₪`,
    href: projectId ? `/projects/${projectId}` : "/movements",
    type: "payment.received",
    entityType: "payment",
    entityId: paymentRef.id,
    dedupeKey: `PAYMENT_RECEIVED:${paymentRef.id}`,
  });

  const movementProjectId = projectId
    ?? priced[0]?.projectId
    ?? null;
  const projectData = project
    ?? (movementProjectId
      ? (await db.doc(projectDocPath(input.businessId, movementProjectId)).get()).data()
      : null);
  await createMoneyMovement({
    actor: input.actor,
    businessId: input.businessId,
    type: "INCOME",
    amount,
    date: paymentDate,
    clientName: typeof projectData?.clientName === "string" ? projectData.clientName : "",
    projectId: movementProjectId,
    taskIds: allocations.map((item) => item.taskId).filter((id): id is string => Boolean(id)),
    paymentId: paymentRef.id,
    paymentMethod: method,
    description: priced.length
      ? priced.map((task) => task.title).join(", ")
      : (typeof projectData?.name === "string" ? projectData.name : "תשלום פרויקט"),
    note: typeof input.notes === "string" ? input.notes : "",
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
  const recorded = (await import("@/lib/firebase/converters")).toPaymentRecord(input.paymentId, data);
  const allocations = recorded.allocations;
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
    if (item.target === "PROJECT_BASE" && item.projectId) {
      const projectRef = db.doc(projectDocPath(input.businessId, item.projectId));
      const projectSnap = await projectRef.get();
      if (!projectSnap.exists) continue;
      const project = toProject(projectSnap.id, projectSnap.data()!);
      const paidAmount = money(Math.max(0, (project.basePaidAmount ?? 0) - item.amount));
      await projectRef.set({
        basePaidAmount: paidAmount,
        baseBalanceDue: remainingBalance(project.basePriceIncludingVat, paidAmount),
        basePaymentStatus: paymentStatusFor(paidAmount, project.basePriceIncludingVat),
        updatedAt: now,
      }, { merge: true });
      continue;
    }
    if (!item.taskId) continue;
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
  await voidMoneyMovementByPayment({ businessId: input.businessId, paymentId: input.paymentId });
  return { ok: true as const, id: input.paymentId };
}
