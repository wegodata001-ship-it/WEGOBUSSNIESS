import { NextResponse } from "next/server";
import { deleteTaskAttachment, renameTaskAttachment, signedTaskAttachmentUrl } from "@/lib/admin/task-assets";
import { requireActor } from "@/lib/auth/server-actor";

function businessIdOf(request: Request, body?: Record<string, unknown>) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("businessId")?.trim() ?? "";
  const fromBody = typeof body?.businessId === "string" ? body.businessId.trim() : "";
  return fromBody || fromQuery;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string; attachmentId: string }> },
) {
  const { taskId, attachmentId } = await context.params;
  const businessId = businessIdOf(request);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await signedTaskAttachmentUrl({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    attachmentId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, url: result.url, name: result.name, contentType: result.contentType });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string; attachmentId: string }> },
) {
  const { taskId, attachmentId } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = businessIdOf(request, body);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await renameTaskAttachment({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    attachmentId,
    name: typeof body.name === "string" ? body.name : "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ taskId: string; attachmentId: string }> },
) {
  const { taskId, attachmentId } = await context.params;
  const businessId = businessIdOf(request);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await deleteTaskAttachment({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    attachmentId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
