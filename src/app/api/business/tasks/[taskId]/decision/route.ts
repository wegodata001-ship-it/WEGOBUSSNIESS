import { NextResponse } from "next/server";
import { decideTask } from "@/lib/admin/task-write";
import { requireActor } from "@/lib/auth/server-actor";

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const action = body.action === "reject" ? "reject" : body.action === "approve" ? "approve" : null;
  if (!action) return NextResponse.json({ error: "TASK_FIELDS" }, { status: 400 });
  const result = await decideTask({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    action,
    reason: typeof body.reason === "string" ? body.reason : "",
    data: body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
