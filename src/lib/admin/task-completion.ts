import { isCompletedTaskStatus } from "@/lib/admin/project-progress";

export function canonicalTaskStatus(status: string) {
  return status === "DONE" ? "COMPLETED" : status;
}

export function taskCompletionPatch(input: {
  previousStatus: string;
  nextStatus: string;
  actorUserId: string;
  now: Date;
}) {
  const next = canonicalTaskStatus(input.nextStatus);
  const wasDone = isCompletedTaskStatus(input.previousStatus);
  const isDone = isCompletedTaskStatus(next);
  if (isDone && !wasDone) {
    return {
      status: "COMPLETED",
      completedAt: input.now,
      completedByUserId: input.actorUserId,
      completedDate: input.now.toISOString().slice(0, 10),
    };
  }
  if (!isDone && wasDone) {
    return {
      status: next,
      completedAt: null,
      completedByUserId: null,
      completedDate: null,
    };
  }
  return { status: isDone ? "COMPLETED" : next };
}
