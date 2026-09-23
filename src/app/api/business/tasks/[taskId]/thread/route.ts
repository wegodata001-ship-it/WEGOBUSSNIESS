import { NextResponse } from "next/server";
import { addTaskComment, listTaskThread } from "@/lib/admin/task-thread";
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
  const result = await addTaskComment({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    body: typeof body.body === "string" ? body.body : "",
    mentions,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
