import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { userDocPath } from "@/lib/firebase/paths";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    businessId?: string;
    notifyInApp?: boolean;
    notifyEmail?: boolean;
  };
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return resolved.error;
  await getAdminDb().doc(userDocPath(resolved.actor!.uid)).set({
    notifyInApp: body.notifyInApp !== false,
    notifyEmail: body.notifyEmail !== false,
    updatedAt: new Date(),
  }, { merge: true });
  return NextResponse.json({ ok: true });
}
