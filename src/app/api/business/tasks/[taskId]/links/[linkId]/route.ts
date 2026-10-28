import { NextResponse } from "next/server";
import { deleteTaskLink, upsertTaskLink } from "@/lib/admin/task-assets";
import { requireActor } from "@/lib/auth/server-actor";

function businessIdOf(request: Request, body?: Record<string, unknown>) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("businessId")?.trim() ?? "";
  const fromBody = typeof body?.businessId === "string" ? body.businessId.trim() : "";
  return fromBody || fromQuery;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string; linkId: string }> },
) {
  const { taskId, linkId } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = businessIdOf(request, body);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await upsertTaskLink({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    linkId,
    title: typeof body.title === "string" ? body.title : "",
    url: typeof body.url === "string" ? body.url : "",
    description: typeof body.description === "string" ? body.description : "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ taskId: string; linkId: string }> },
) {
  const { taskId, linkId } = await context.params;
  const businessId = businessIdOf(request);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await deleteTaskLink({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    linkId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
