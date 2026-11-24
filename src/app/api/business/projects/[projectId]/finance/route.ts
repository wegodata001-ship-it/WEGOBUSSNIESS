import { NextResponse } from "next/server";
import { setProjectBasePrice } from "@/lib/admin/project-finance-write";
import { isTaskSoftDeleted } from "@/lib/admin/task-delete-rules";
import { requireActor } from "@/lib/auth/server-actor";
import { canSetTaskPrice, canViewTaskFinance } from "@/lib/finance/access";
import { computeProjectFinance } from "@/lib/finance/project-ledger";
import { getAdminDb } from "@/lib/firebase/admin";
import { toProject, toTask } from "@/lib/firebase/converters";
import { projectDocPath, tasksPath } from "@/lib/firebase/paths";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const businessId = new URL(request.url).searchParams.get("businessId")?.trim() ?? "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!canViewTaskFinance(actor)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const db = getAdminDb();
  const projectSnap = await db.doc(projectDocPath(actor.businessId, projectId)).get();
  if (!projectSnap.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const project = toProject(projectSnap.id, projectSnap.data()!);
  const tasksSnap = await db.collection(tasksPath(actor.businessId)).where("projectId", "==", projectId).get();
  const tasks = tasksSnap.docs
    .map((docSnap) => toTask(docSnap.id, docSnap.data()))
    .filter((task) => !isTaskSoftDeleted(task));
  const ledger = computeProjectFinance(project, tasks);
  return NextResponse.json({
    ok: true,
    project: {
      basePriceBeforeVat: project.basePriceBeforeVat,
      baseVatAmount: project.baseVatAmount,
      basePriceIncludingVat: project.basePriceIncludingVat,
      basePriceVatMode: project.basePriceVatMode,
      basePaidAmount: project.basePaidAmount,
      baseBalanceDue: project.baseBalanceDue,
      basePaymentStatus: project.basePaymentStatus,
      baseVatRate: project.baseVatRate,
    },
    ledger,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const body = await request.json().catch(() => ({})) as {
    businessId?: string;
    priceBeforeVat?: unknown;
    amount?: unknown;
    vatMode?: unknown;
  };
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  if (!canSetTaskPrice(resolved.actor!)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const result = await setProjectBasePrice({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    projectId,
    priceBeforeVat: body.amount !== undefined ? body.amount : body.priceBeforeVat,
    vatMode: body.vatMode,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
