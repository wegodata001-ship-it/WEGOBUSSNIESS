import { NextResponse } from "next/server";
import { voidTaskPayment } from "@/lib/admin/payment-write";
import { requireActor } from "@/lib/auth/server-actor";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const { paymentId } = await context.params;

  const result = await voidTaskPayment({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    paymentId,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
