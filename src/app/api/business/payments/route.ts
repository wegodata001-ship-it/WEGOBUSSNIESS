import { NextResponse } from "next/server";
import { receiveTaskPayment } from "@/lib/admin/payment-write";
import { canViewTaskFinance } from "@/lib/finance/access";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { toPaymentRecord } from "@/lib/firebase/converters";
import { getAdminDb } from "@/lib/firebase/admin";
import { toTimestamp } from "@/lib/dates/timestamp";
import { paymentsPath } from "@/lib/firebase/paths";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId") ?? "";
  const taskId = url.searchParams.get("taskId") ?? "";
  const projectId = url.searchParams.get("projectId") ?? "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!canViewTaskFinance(actor) && !actorCan(actor, "finance.view")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const snap = await getAdminDb().collection(paymentsPath(actor.businessId)).get();
  let payments = snap.docs.map((docSnap) => toPaymentRecord(docSnap.id, docSnap.data()));

  if (taskId) {
    payments = payments.filter((item) => item.allocations.some((row) => row.taskId === taskId));
  } else if (projectId) {
    const { tasksPath } = await import("@/lib/firebase/paths");
    const { paymentTouchesProject } = await import("@/lib/finance/project-ledger");
    const tasksSnap = await getAdminDb().collection(tasksPath(actor.businessId)).where("projectId", "==", projectId).get();
    const projectTaskIds = new Set(tasksSnap.docs.map((docSnap) => docSnap.id));
    payments = payments.filter((item) => paymentTouchesProject(item, projectId, projectTaskIds));
  }

  // When listing without a task filter, hide orphan payments tied only to deleted tasks/projects.
  if (!taskId) {
    const { tasksPath, projectsPath } = await import("@/lib/firebase/paths");
    const [tasksSnap, projectsSnap] = await Promise.all([
      getAdminDb().collection(tasksPath(actor.businessId)).get(),
      getAdminDb().collection(projectsPath(actor.businessId)).get(),
    ]);
    const liveTaskIds = new Set(tasksSnap.docs.map((docSnap) => docSnap.id));
    const liveProjectIds = new Set(projectsSnap.docs.map((docSnap) => docSnap.id));
    const { activePayments } = await import("@/lib/finance/orphan");
    payments = activePayments(payments, liveTaskIds, liveProjectIds);
  }

  payments = payments.sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));
  return NextResponse.json({ data: payments });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;

  const result = await receiveTaskPayment({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskIds: Array.isArray(body.taskIds) ? body.taskIds : [],
    projectId: typeof body.projectId === "string" ? body.projectId : null,
    amount: body.amount,
    paymentMethod: body.paymentMethod,
    paymentDate: body.paymentDate,
    reference: body.reference,
    notes: body.notes,
    allocations: Array.isArray(body.allocations) ? body.allocations : undefined,
    allowOverpay: body.allowOverpay !== false,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id, allocations: result.allocations });
}
