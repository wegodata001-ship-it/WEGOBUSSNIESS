import { NextResponse } from "next/server";
import { findBusinessDocByToken } from "@/lib/admin/business-doc-write";
import { getAdminDb } from "@/lib/firebase/admin";
import { businessDocumentDocPath, businessDocPath, businessSettingsDocPath } from "@/lib/firebase/paths";
import { toBusiness, toBusinessSettings } from "@/lib/firebase/converters";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const doc = await findBusinessDocByToken(token);
  if (!doc) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (doc.status === "SENT") {
    await getAdminDb().doc(businessDocumentDocPath(doc.businessId, doc.id)).set({
      status: "VIEWED",
      viewedAt: doc.viewedAt ?? new Date(),
      updatedAt: new Date(),
    }, { merge: true });
    doc.status = "VIEWED";
    doc.viewedAt = doc.viewedAt ?? new Date();
  }
  const db = getAdminDb();
  const [businessSnap, settingsSnap] = await Promise.all([
    db.doc(businessDocPath(doc.businessId)).get(),
    db.doc(businessSettingsDocPath(doc.businessId)).get(),
  ]);
  return NextResponse.json({
    doc,
    business: businessSnap.exists ? toBusiness(businessSnap.id, businessSnap.data()!) : null,
    settings: toBusinessSettings("general", settingsSnap.data() ?? { businessId: doc.businessId }),
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const doc = await findBusinessDocByToken(token);
  if (!doc) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!doc.requiresSignature) return NextResponse.json({ error: "SIGNATURE_NOT_REQUIRED" }, { status: 400 });
  if (doc.status === "SIGNED") return NextResponse.json({ error: "ALREADY_SIGNED" }, { status: 409 });
  const body = await request.json().catch(() => ({})) as { signerName?: string; signerIdNumber?: string; signature?: string };
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  if (!signerName || !signature.startsWith("data:image")) {
    return NextResponse.json({ error: "SIGN_FIELDS" }, { status: 400 });
  }
  await getAdminDb().doc(businessDocumentDocPath(doc.businessId, doc.id)).set({
    status: "SIGNED",
    frozen: true,
    signedAt: new Date(),
    signerName,
    signerIdNumber: typeof body.signerIdNumber === "string" ? body.signerIdNumber.trim() || null : null,
    signature,
    updatedAt: new Date(),
  }, { merge: true });
  return NextResponse.json({ ok: true });
}
