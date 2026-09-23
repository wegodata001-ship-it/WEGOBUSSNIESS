import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { todayInTimeZone } from "@/lib/dates/format";
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
  if (!actorCan(actor, "tasks.start")) {
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

  if (openSession) {
    return NextResponse.json({ ok: true, sessionId: openSession.id, alreadyOpen: true });
  }

  const now = new Date();
  const sessionRef = db.collection(workSessionsPath(businessId)).doc();
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).format(now);

  await sessionRef.set({
    businessId,
    employeeId: actor.employeeId ?? task.assigneeEmployeeId,
    userId: actor.uid,
    taskId,
    kind: "TASK",
    date: todayInTimeZone("Asia/Jerusalem"),
    startTime: time,
    endTime: null,
    startedAt: now,
    endedAt: null,
    durationMinutes: null,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
  });

  await taskRef.set({
    status: "IN_PROGRESS",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ ok: true, sessionId: sessionRef.id });
}
