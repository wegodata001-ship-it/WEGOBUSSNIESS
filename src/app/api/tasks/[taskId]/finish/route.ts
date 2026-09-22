import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { taskDocPath, workSessionsPath } from "@/lib/firebase/paths";

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const body = await request.json().catch(() => ({}));
  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  if (!businessId) {
    return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  }

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actorCan(actor, "tasks.complete")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { taskId } = await context.params;
  const db = getAdminDb();
  const taskRef = db.doc(taskDocPath(businessId, taskId));
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists) {
    return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
  }

  const task = taskSnap.data()!;
  const collaborators = Array.isArray(task.collaboratorIds) ? task.collaboratorIds : [];
  const onTask = task.assigneeId === actor.employeeId
    || task.assigneeEmployeeId === actor.employeeId
    || collaborators.includes(actor.employeeId);
  if (!actor.isOwnerOrManager && !onTask) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const sessions = await db.collection(workSessionsPath(businessId)).get();
  const openSession = sessions.docs.find((docSnap) =>
    docSnap.data().taskId === taskId && docSnap.data().status === "OPEN",
  );

  const now = new Date();
  if (openSession) {
    const sessionRef = openSession.ref;
    const startedAt = openSession.data().startedAt?.toDate?.()
      ? openSession.data().startedAt.toDate()
      : now;
    const durationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));
    const time = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }).format(now);

    await sessionRef.set({
      endedAt: now,
      endTime: time,
      durationMinutes,
      status: "CLOSED",
      updatedAt: now,
    }, { merge: true });
  }

  await taskRef.set({
    status: "DONE",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
