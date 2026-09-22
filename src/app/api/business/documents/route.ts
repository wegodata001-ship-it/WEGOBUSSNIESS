import { NextResponse } from "next/server";
import { writeActivity } from "@/lib/admin/activity";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { documentDocPath, documentsPath } from "@/lib/firebase/paths";

function safeName(name: string) {
  return name.replace(/[^\w.\u0590-\u05ff\u0600-\u06ff-]+/g, "-").slice(0, 80) || "file";
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
  const businessId = String(form.get("businessId") ?? "");
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actorCan(actor, "documents.manage") && !actor.isSuperAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.collection(documentsPath(businessId)).doc();
  const fileName = safeName(file.name);
  const storagePath = `businesses/${businessId}/documents/${ref.id}/${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const bucket = getAdminStorage().bucket();
  await bucket.file(storagePath).save(buffer, {
    contentType: file.type || "application/octet-stream",
    resumable: false,
  });

  const now = new Date();
  await ref.set({
    businessId,
    name: String(form.get("name") ?? "").trim() || file.name,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    storagePath,
    url: null,
    projectId: String(form.get("projectId") ?? "").trim() || null,
    clientName: String(form.get("clientName") ?? "").trim(),
    category: String(form.get("category") ?? "OTHER"),
    note: String(form.get("note") ?? "").trim(),
    uploadedByUserId: actor.uid,
    createdAt: now,
    updatedAt: now,
  });

  await writeActivity({
    businessId,
    actorUserId: actor.uid,
    action: "uploadDocument",
    entityType: "document",
    entityId: ref.id,
    message: `הועלה מסמך: ${file.name}`,
  });

  return NextResponse.json({ ok: true, id: ref.id });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!businessId || !id) return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actorCan(actor, "documents.manage") && !actor.isSuperAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const db = getAdminDb();
  const snap = await db.doc(documentDocPath(businessId, id)).get();
  if (!snap.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const storagePath = String(snap.data()?.storagePath ?? "");
  if (storagePath) {
    await getAdminStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
  }
  await db.doc(documentDocPath(businessId, id)).delete();
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!businessId || !id) return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });

  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  const actor = resolved.actor!;
  if (!actorCan(actor, "documents.view") && !actor.isSuperAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const snap = await getAdminDb().doc(documentDocPath(businessId, id)).get();
  if (!snap.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const storagePath = String(snap.data()?.storagePath ?? "");
  if (!storagePath) return NextResponse.json({ error: "NO_FILE" }, { status: 404 });
  const [signed] = await getAdminStorage().bucket().file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 15,
  });
  return NextResponse.json({ url: signed, name: snap.data()?.fileName ?? snap.data()?.name });
}
