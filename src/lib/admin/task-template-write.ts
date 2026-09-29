import { taskLibraryKey } from "@/lib/admin/task-library";
import { asTaskKind } from "@/lib/admin/palette";
import { getAdminDb } from "@/lib/firebase/admin";
import { taskTemplatesPath } from "@/lib/firebase/paths";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function ensureTaskTemplate(input: {
  businessId: string;
  title: string;
  description?: string;
  taskType?: string;
  departmentId?: string | null;
}) {
  const title = text(input.title);
  if (!title) return null;
  const taskType = asTaskKind(input.taskType);
  const titleKey = taskLibraryKey(title, taskType);
  const db = getAdminDb();
  const existing = await db.collection(taskTemplatesPath(input.businessId)).where("titleKey", "==", titleKey).limit(1).get();
  if (!existing.empty) return existing.docs[0]?.id ?? null;
  const ref = db.collection(taskTemplatesPath(input.businessId)).doc();
  const now = new Date();
  await ref.set({
    businessId: input.businessId,
    title,
    description: text(input.description),
    taskType,
    departmentId: text(input.departmentId) || null,
    titleKey,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}
