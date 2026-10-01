import { NextResponse } from "next/server";
import { updateTaskWork } from "@/lib/admin/task-write";
import { requireActor } from "@/lib/auth/server-actor";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
  const result = await updateTaskWork({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    taskId,
    data: {
      scheduledDate: data.scheduledDate === undefined ? undefined : (data.scheduledDate as string | null),
      startTime: data.startTime === undefined ? undefined : (data.startTime as string | null),
      endTime: data.endTime === undefined ? undefined : (data.endTime as string | null),
      description: typeof data.description === "string" ? data.description : undefined,
      status: typeof data.status === "string" ? data.status : undefined,
    },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
