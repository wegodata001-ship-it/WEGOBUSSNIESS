import { computeProjectProgress } from "@/lib/admin/project-progress";
import { isTaskSoftDeleted } from "@/lib/admin/task-delete-rules";
import { getAdminDb } from "@/lib/firebase/admin";
import { projectDocPath, tasksPath } from "@/lib/firebase/paths";

export async function syncProjectProgressFromTasks(businessId: string, projectId: string | null | undefined) {
  const id = typeof projectId === "string" ? projectId.trim() : "";
  if (!id) return;
  const db = getAdminDb();
  const snap = await db.collection(tasksPath(businessId)).where("projectId", "==", id).get();
  const active = snap.docs.filter((docSnap) => !isTaskSoftDeleted(docSnap.data()));
  const progress = computeProjectProgress(active.map((docSnap) => ({ status: String(docSnap.data().status ?? "") })));
  await db.doc(projectDocPath(businessId, id)).set({ progress, updatedAt: new Date() }, { merge: true });
}
