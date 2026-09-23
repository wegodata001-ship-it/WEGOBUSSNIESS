import { NextResponse } from "next/server";
import { upsertTask } from "@/lib/admin/task-write";
import { requireActor } from "@/lib/auth/server-actor";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) {
    return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  }

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;

  const result = await upsertTask({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    data: body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : body,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
