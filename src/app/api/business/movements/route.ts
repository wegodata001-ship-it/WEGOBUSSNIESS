import { NextResponse } from "next/server";
import { createMoneyMovement } from "@/lib/admin/movement-write";
import { requireActor } from "@/lib/auth/server-actor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await createMoneyMovement({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    type: body.type,
    amount: body.amount,
    date: body.date,
    clientId: body.clientId,
    clientName: body.clientName,
    projectId: body.projectId,
    taskIds: body.taskIds,
    paymentMethod: body.paymentMethod,
    description: body.description,
    note: body.note,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
