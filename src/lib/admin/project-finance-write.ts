import { writeActivity } from "@/lib/admin/activity";
import { canSetTaskPrice } from "@/lib/finance/access";
import { money, parseMoney } from "@/lib/finance/money";
import {
  calculateProjectBasePrice,
  paymentStatusFor,
  remainingBalance,
  resolveProjectBaseVatMode,
  type ProjectBaseVatMode,
} from "@/lib/finance/vat";
import type { ServerActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { toProject } from "@/lib/firebase/converters";
import { projectDocPath } from "@/lib/firebase/paths";
import { readBusinessVatRate, type PaymentWriteError } from "@/lib/admin/payment-write";

export async function setProjectBasePrice(input: {
  actor: ServerActor;
  businessId: string;
  projectId: string;
  /** Entered amount — meaning depends on vatMode. */
  priceBeforeVat: unknown;
  vatMode?: unknown;
}) {
  if (!canSetTaskPrice(input.actor)) {
    return { ok: false as const, error: "FORBIDDEN" as PaymentWriteError, status: 403 };
  }
  const db = getAdminDb();
  const ref = db.doc(projectDocPath(input.businessId, input.projectId));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" as PaymentWriteError, status: 404 };

  const existing = toProject(snap.id, snap.data()!);
  const price = parseMoney(input.priceBeforeVat);
  if (price === null || price < 0) {
    return { ok: false as const, error: "TASK_FIELDS" as PaymentWriteError, status: 400 };
  }

  const vatMode: ProjectBaseVatMode = input.vatMode !== undefined
    ? resolveProjectBaseVatMode(input.vatMode)
    : existing.basePriceVatMode;
  // Always use current business VAT settings (never freeze a hardcoded rate in code).
  const vatRate = await readBusinessVatRate(input.businessId);
  const calc = calculateProjectBasePrice(price, vatRate, vatMode);
  const paidAmount = money(existing.basePaidAmount ?? 0);
  const now = new Date();
  await ref.set({
    basePriceBeforeVat: calc.priceBeforeVat,
    baseVatRate: calc.vatRate,
    baseVatAmount: calc.vatAmount,
    basePriceIncludingVat: calc.priceIncludingVat,
    basePriceVatMode: calc.vatMode,
    basePaidAmount: paidAmount,
    baseBalanceDue: remainingBalance(calc.priceIncludingVat, paidAmount),
    basePaymentStatus: paymentStatusFor(paidAmount, calc.priceIncludingVat),
    updatedAt: now,
  }, { merge: true });

  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actor.uid,
    action: "setProjectBasePrice",
    entityType: "project",
    entityId: input.projectId,
    message: "עודכן מחיר בסיס לפרויקט",
  });

  return { ok: true as const, id: input.projectId };
}
