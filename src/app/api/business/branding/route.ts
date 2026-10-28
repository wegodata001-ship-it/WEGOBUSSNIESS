import { NextResponse } from "next/server";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { getAdminBucket } from "@/lib/firebase/admin-storage";
import { businessDocPath, businessSettingsDocPath } from "@/lib/firebase/paths";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
  const businessId = String(form.get("businessId") ?? "");
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actorCan(actor, "settings.manage") && !actor.isSuperAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `businesses/${businessId}/branding/logo.${ext}`;
  await getAdminBucket().file(storagePath).save(Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "image/png",
    resumable: false,
  });
  const [url] = await getAdminBucket().file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24 * 365,
  });
  const now = new Date();
  const db = getAdminDb();
  await Promise.all([
    db.doc(businessDocPath(businessId)).set({ logoUrl: url, updatedAt: now }, { merge: true }),
    db.doc(businessSettingsDocPath(businessId)).set({
      businessId,
      logoUrl: url,
      logoStoragePath: storagePath,
      updatedAt: now,
    }, { merge: true }),
  ]);
  return NextResponse.json({ ok: true, url });
}

export async function DELETE(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId") ?? "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actorCan(actor, "settings.manage") && !actor.isSuperAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const db = getAdminDb();
  const settingsRef = db.doc(businessSettingsDocPath(businessId));
  const snap = await settingsRef.get();
  const storagePath = typeof snap.data()?.logoStoragePath === "string" ? snap.data()?.logoStoragePath : "";
  if (storagePath) {
    await getAdminBucket().file(storagePath).delete({ ignoreNotFound: true });
  }
  const now = new Date();
  await Promise.all([
    db.doc(businessDocPath(businessId)).set({ logoUrl: null, updatedAt: now }, { merge: true }),
    settingsRef.set({
      businessId,
      logoUrl: null,
      logoStoragePath: null,
      updatedAt: now,
    }, { merge: true }),
  ]);
  return NextResponse.json({ ok: true });
}
