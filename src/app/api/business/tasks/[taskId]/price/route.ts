import { NextResponse } from "next/server";
import { setTaskPrice } from "@/lib/admin/payment-write";
import { requireActor } from "@/lib/auth/server-actor";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { taskId } = await context.params;

  const result = await setTaskPrice({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    priceBeforeVat: body.priceBeforeVat,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
