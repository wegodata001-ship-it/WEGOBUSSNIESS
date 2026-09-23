import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { writeActivity } from "@/lib/admin/activity";
import { dateTimeInZone, zonedDateTime } from "@/lib/admin/meeting-time";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { isDateOnly, isTimeOnly } from "@/lib/dates/format";
import { DEFAULT_TIMEZONE } from "@/lib/env";
import { getAdminDb } from "@/lib/firebase/admin";
import { businessDocPath, workSessionDocPath } from "@/lib/firebase/paths";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const date = typeof body.date === "string" ? body.date : "";
  const clockIn = typeof body.clockIn === "string" ? body.clockIn : "";
  const clockOut = typeof body.clockOut === "string" ? body.clockOut : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!businessId || !sessionId) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });
  }
  if (!isDateOnly(date) || !isTimeOnly(clockIn)) {
    return NextResponse.json({ error: "INVALID_TIME" }, { status: 400 });
  }

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actor.isOwnerOrManager && !actorCan(actor, "workHours.manage")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const db = getAdminDb();
  const businessSnap = await db.doc(businessDocPath(businessId)).get();
  const timeZone = typeof businessSnap.data()?.timezone === "string" ? businessSnap.data()!.timezone : DEFAULT_TIMEZONE;
  const ref = db.doc(workSessionDocPath(businessId, sessionId));
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const current = snap.data()!;
  const originalClockIn = current.startedAt?.toDate?.() ?? null;
  const originalClockOut = current.endedAt?.toDate?.() ?? null;
  const nextIn = zonedDateTime(date, clockIn, timeZone);
  const nextOut = clockOut && isTimeOnly(clockOut) ? zonedDateTime(date, clockOut, timeZone) : null;
  if (!nextIn) {
    return NextResponse.json({ error: "INVALID_TIME" }, { status: 400 });
  }

  const closed = Boolean(nextOut);
  const durationMinutes = closed
    ? Math.max(0, Math.round((nextOut!.getTime() - nextIn.getTime()) / 60000))
    : null;

  await ref.set({
    date,
    startTime: clockIn,
    endTime: closed ? clockOut : null,
    startedAt: nextIn,
    endedAt: nextOut,
    durationMinutes,
    status: closed ? "CLOSED" : "OPEN",
    note: note || current.note || null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await writeActivity({
    businessId,
    actorUserId: actor.uid,
    action: "attendance_correct",
    entityType: "workSession",
    entityId: sessionId,
    message: `תיקון נוכחות: ${reason}`,
    meta: {
      originalClockIn: originalClockIn ? originalClockIn.toISOString() : null,
      originalClockOut: originalClockOut ? originalClockOut.toISOString() : null,
      newClockIn: nextIn.toISOString(),
      newClockOut: nextOut ? nextOut.toISOString() : null,
      changedBy: actor.uid,
      changedAt: new Date().toISOString(),
      reason,
    },
  });

  return NextResponse.json({
    ok: true,
    durationMinutes,
    startTime: clockIn,
    endTime: closed ? clockOut : null,
    zoned: dateTimeInZone(nextIn, timeZone),
  });
}
