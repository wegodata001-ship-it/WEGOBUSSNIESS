import { getAdminDb } from "@/lib/firebase/admin";
import { employeeDocPath, notificationsPath } from "@/lib/firebase/paths";

export async function notifyEmployees(input: {
  businessId: string;
  employeeIds: string[];
  title: string;
  body: string;
  href?: string;
}) {
  const db = getAdminDb();
  const unique = [...new Set(input.employeeIds.filter(Boolean))];
  await Promise.all(unique.map(async (employeeId) => {
    const snap = await db.doc(employeeDocPath(input.businessId, employeeId)).get();
    const userId = typeof snap.data()?.userId === "string" ? snap.data()!.userId : "";
    if (!userId) return;
    await db.collection(notificationsPath(input.businessId)).add({
      businessId: input.businessId,
      userId,
      title: input.title,
      body: input.body,
      href: input.href ?? "/tasks",
      isRead: false,
      createdAt: new Date(),
    });
  }));
}
