import { NextResponse } from "next/server";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { runNotificationJobs } from "@/lib/notify/jobs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { businessId?: string };
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actor.isOwnerOrManager && !actorCan(actor, "settings.manage")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const summary = await runNotificationJobs({ businessId, forceMorning: true });
  return NextResponse.json({ ok: true, summary });
}
