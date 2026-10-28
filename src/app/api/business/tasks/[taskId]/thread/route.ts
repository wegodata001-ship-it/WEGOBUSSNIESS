import { NextResponse } from "next/server";
import { addTaskComment, deleteTaskComment, editTaskComment, listTaskThread, markTaskThreadRead } from "@/lib/admin/task-thread";
import { requireActor } from "@/lib/auth/server-actor";

function businessIdOf(request: Request, body?: Record<string, unknown>) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("businessId")?.trim() ?? "";
  const fromBody = typeof body?.businessId === "string" ? body.businessId.trim() : "";
  return fromBody || fromQuery;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const businessId = businessIdOf(request);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await listTaskThread(resolved.actor!, resolved.actor!.businessId, taskId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, comments: result.comments, activity: result.activity });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = businessIdOf(request, body);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const mentions = Array.isArray(body.mentions) ? body.mentions.filter((item): item is string => typeof item === "string") : [];
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter((item): item is { name: string; url?: string | null; id?: string | null } => Boolean(item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string"))
    : [];
  const result = await addTaskComment({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    body: typeof body.body === "string" ? body.body : "",
    mentions,
    attachments,
    linkUrl: typeof body.linkUrl === "string" ? body.linkUrl : null,
    linkTitle: typeof body.linkTitle === "string" ? body.linkTitle : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = businessIdOf(request, body);
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  if (body.markRead === true) {
    const result = await markTaskThreadRead({
      actor: resolved.actor!,
      businessId: resolved.actor!.businessId,
      taskId,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  }
  const commentId = typeof body.commentId === "string" ? body.commentId : "";
  if (!commentId) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  const result = await editTaskComment({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    commentId,
    body: typeof body.body === "string" ? body.body : "",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const url = new URL(request.url);
  const commentId = url.searchParams.get("commentId") ?? "";
  const businessId = businessIdOf(request);
  if (!businessId || !commentId) return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const result = await deleteTaskComment({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    commentId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
