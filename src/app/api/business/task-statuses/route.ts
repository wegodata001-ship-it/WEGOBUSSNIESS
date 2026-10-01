import { NextResponse } from "next/server";
import { ensureDefaultTaskStatuses, upsertTaskStatus, reorderTaskStatuses } from "@/lib/admin/task-status-write";
import { requireActor } from "@/lib/auth/server-actor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId") ?? "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const data = await ensureDefaultTaskStatuses(resolved.actor!.businessId);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  if (body.action === "reorder" && Array.isArray(body.ids)) {
    const result = await reorderTaskStatuses({
      actor: resolved.actor!,
      businessId: resolved.actor!.businessId,
      ids: body.ids.filter((id): id is string => typeof id === "string"),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  }
  const result = await upsertTaskStatus({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    id: typeof body.id === "string" ? body.id : undefined,
    data: (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
