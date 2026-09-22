import { getAdminDb } from "@/lib/firebase/admin";
import { activityLogsPath } from "@/lib/firebase/paths";

export async function writeActivity(input: {
  businessId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  message: string;
}) {
  const db = getAdminDb();
  await db.collection(activityLogsPath(input.businessId)).add({
    businessId: input.businessId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    message: input.message,
    createdAt: new Date(),
  });
}
