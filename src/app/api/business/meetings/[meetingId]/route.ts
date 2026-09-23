import { NextResponse } from "next/server";
import { deleteMeetingDoc, upsertMeeting } from "@/lib/admin/meeting-write";
import { requireActor } from "@/lib/auth/server-actor";

async function actorFor(request: Request) {
  const body = await request.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) {
    return { error: NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 }), body };
  }
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) {
    return { error: resolved.error, body };
  }
  return { actor: resolved.actor!, businessId: resolved.actor!.businessId, body };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const resolved = await actorFor(request);
  if ("error" in resolved && resolved.error) return resolved.error;

  const result = await upsertMeeting({
    actor: resolved.actor!,
    businessId: resolved.businessId!,
    meetingId,
    data: resolved.body.data && typeof resolved.body.data === "object"
      ? resolved.body.data as Record<string, unknown>
      : resolved.body,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, id: result.id });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await context.params;
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId") || "";
  if (!businessId) {
    return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  }
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;

  const result = await deleteMeetingDoc({
    actor: resolved.actor!,
    businessId: resolved.actor!.businessId,
    meetingId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
