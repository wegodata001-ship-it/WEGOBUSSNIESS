import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { notifyUnpaidOnComplete } from "@/lib/admin/notify";
import { isCompletedTaskStatus } from "@/lib/admin/project-progress";
import { syncProjectProgressFromTasks } from "@/lib/admin/project-progress-sync";
import { taskCompletionPatch } from "@/lib/admin/task-completion";
import { isEmployeeOnTask } from "@/lib/admin/task-team";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { remainingBalance } from "@/lib/finance/vat";
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
  if (!actor.isOwnerOrManager && !actor.employeeId) {
    return NextResponse.json({ error: "EMPLOYEE_REQUIRED" }, { status: 403 });
  }

  const { taskId } = await context.params;
  const db = getAdminDb();
  const taskRef = db.doc(taskDocPath(businessId, taskId));
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists) {
    return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
  }

  const task = taskSnap.data()!;
  if (!actor.isOwnerOrManager && !isEmployeeOnTask(task, actor.employeeId)) {
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

  const wasDone = isCompletedTaskStatus(typeof task.status === "string" ? task.status : "");
  const completion = taskCompletionPatch({
    previousStatus: typeof task.status === "string" ? task.status : "",
    nextStatus: "COMPLETED",
    actorUserId: actor.uid,
    now,
  });
  await taskRef.set({
    ...completion,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await syncProjectProgressFromTasks(businessId, typeof task.projectId === "string" ? task.projectId : null);

  if (wasDone) return NextResponse.json({ ok: true });

  const priceIncludingVat = typeof task.priceIncludingVat === "number" ? task.priceIncludingVat : null;
  const paidAmount = typeof task.paidAmount === "number" ? task.paidAmount : 0;
  await notifyUnpaidOnComplete({
    businessId,
    taskId,
    title: typeof task.title === "string" ? task.title : "",
    balanceDue: remainingBalance(priceIncludingVat, paidAmount),
    skipUserId: actor.uid,
  });

  return NextResponse.json({ ok: true });
}
