import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { notificationDocPath, notificationsPath } from "@/lib/firebase/paths";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  const db = getAdminDb();

  if (body.all === true) {
    const snap = await db.collection(notificationsPath(actor.businessId)).where("userId", "==", actor.uid).get();
    await Promise.all(snap.docs
      .filter((docSnap) => !docSnap.data().isRead)
      .map((docSnap) => docSnap.ref.set({ isRead: true, read: true }, { merge: true })));
    return NextResponse.json({ ok: true });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  const ref = db.doc(notificationDocPath(actor.businessId, id));
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== actor.uid) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  await ref.set({ isRead: true, read: true }, { merge: true });
  return NextResponse.json({ ok: true, id });
}
