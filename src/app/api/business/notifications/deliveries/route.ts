import { NextResponse } from "next/server";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { getAdminDb } from "@/lib/firebase/admin";
import { notificationDeliveriesPath, notificationDeliveryDocPath } from "@/lib/firebase/paths";
import { retryFailedDelivery } from "@/lib/notify/service";

export const dynamic = "force-dynamic";

async function requireMailAdmin(request: Request, businessId: string) {
  const resolved = await requireActor(request, businessId);
  if ("error" in resolved && resolved.error) return { error: resolved.error };
  const actor = resolved.actor!;
  if (!actor.isOwnerOrManager && !actorCan(actor, "settings.manage")) {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }
  return { actor };
}

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId") ?? "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const auth = await requireMailAdmin(request, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const snap = await getAdminDb().collection(notificationDeliveriesPath(businessId)).get();
  const items = snap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        channel: data.channel ?? "",
        recipient: data.recipient ?? "",
        status: data.status ?? "",
        type: data.type ?? "",
        subject: data.subject ?? "",
        errorCode: data.errorCode ?? "",
        providerMessageId: data.providerMessageId ?? "",
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    })
    .filter((item) => item.channel === "EMAIL")
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, 80);
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { businessId?: string; deliveryId?: string };
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  const deliveryId = typeof body.deliveryId === "string" ? body.deliveryId.trim() : "";
  if (!businessId || !deliveryId) return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  const auth = await requireMailAdmin(request, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const exists = await getAdminDb().doc(notificationDeliveryDocPath(businessId, deliveryId)).get();
  if (!exists.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const result = await retryFailedDelivery(businessId, deliveryId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
