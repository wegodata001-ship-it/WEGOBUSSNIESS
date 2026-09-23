import { getAdminDb } from "@/lib/firebase/admin";
import { taskActivityPath } from "@/lib/firebase/paths";
import { writeActivity } from "@/lib/admin/activity";

export async function writeTaskActivity(input: {
  businessId: string;
  taskId: string;
  actorUserId: string;
  actorEmployeeId?: string | null;
  type: string;
  message: string;
}) {
  const db = getAdminDb();
  await db.collection(taskActivityPath(input.businessId, input.taskId)).add({
    businessId: input.businessId,
    taskId: input.taskId,
    actorUserId: input.actorUserId,
    actorEmployeeId: input.actorEmployeeId ?? null,
    type: input.type,
    message: input.message,
    createdAt: new Date(),
  });
  await writeActivity({
    businessId: input.businessId,
    actorUserId: input.actorUserId,
    action: input.type,
    entityType: "task",
    entityId: input.taskId,
    message: input.message,
  });
}
