import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { writeActivity } from "@/lib/admin/activity";
import { dateTimeInZone } from "@/lib/admin/meeting-time";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { DEFAULT_TIMEZONE } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { businessDocPath, workSessionsPath } from "@/lib/firebase/paths";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  if (!businessId) {
    return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  }

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actorCan(actor, "workHours.viewOwn") && !actor.isOwnerOrManager) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (!actor.employeeId) {
    return NextResponse.json({ error: "NO_EMPLOYEE" }, { status: 403 });
  }

  const db = getAdminDb();
  const businessSnap = await db.doc(businessDocPath(businessId)).get();
  const timeZone = typeof businessSnap.data()?.timezone === "string" ? businessSnap.data()!.timezone : DEFAULT_TIMEZONE;
  const snap = await db.collection(workSessionsPath(businessId)).get();
  const open = snap.docs.find((docSnap) => {
    const data = docSnap.data();
    return data.employeeId === actor.employeeId
      && data.status === "OPEN"
      && (data.kind === "ATTENDANCE" || !data.taskId);
  });
  if (!open) {
    return NextResponse.json({ error: "NO_OPEN_SESSION" }, { status: 404 });
  }

  const started = open.data().startedAt?.toDate?.() as Date | undefined;
  const now = new Date();
  const durationMinutes = started
    ? Math.max(0, Math.round((now.getTime() - started.getTime()) / 60000))
    : 0;
  const zoned = dateTimeInZone(now, timeZone);

  await open.ref.set({
    endTime: zoned?.time ?? null,
    endedAt: FieldValue.serverTimestamp(),
    durationMinutes,
    status: "CLOSED",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await writeActivity({
    businessId,
    actorUserId: actor.uid,
    action: "clock_out",
    entityType: "workSession",
    entityId: open.id,
    message: "יציאה מהעבודה",
  });

  return NextResponse.json({
    ok: true,
    sessionId: open.id,
    durationMinutes,
    endTime: zoned?.time ?? null,
  });
}
