import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { writeActivity } from "@/lib/admin/activity";
import { dateTimeInZone } from "@/lib/admin/meeting-time";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { todayInTimeZone } from "@/lib/dates/format";
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
  const alreadyOpen = snap.docs.find((docSnap) => {
    const data = docSnap.data();
    return data.employeeId === actor.employeeId
      && data.status === "OPEN"
      && (data.kind === "ATTENDANCE" || !data.taskId);
  });
  if (alreadyOpen) {
    return NextResponse.json({ error: "ALREADY_OPEN", sessionId: alreadyOpen.id }, { status: 409 });
  }

  const now = new Date();
  const zoned = dateTimeInZone(now, timeZone);
  const ref = db.collection(workSessionsPath(businessId)).doc();
  await ref.set({
    businessId,
    employeeId: actor.employeeId,
    userId: actor.uid,
    taskId: null,
    kind: "ATTENDANCE",
    date: todayInTimeZone(timeZone),
    startTime: zoned?.time ?? "00:00",
    endTime: null,
    startedAt: FieldValue.serverTimestamp(),
    endedAt: null,
    durationMinutes: null,
    status: "OPEN",
    note: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeActivity({
    businessId,
    actorUserId: actor.uid,
    action: "clock_in",
    entityType: "workSession",
    entityId: ref.id,
    message: "כניסה לעבודה",
  });

  return NextResponse.json({ ok: true, sessionId: ref.id, startTime: zoned?.time ?? null });
}
