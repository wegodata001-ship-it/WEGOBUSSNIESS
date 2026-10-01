import { NextResponse } from "next/server";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { mergeNotificationSettings } from "@/lib/notify/catalog";
import { loadNotificationSettings, saveNotificationSettings } from "@/lib/notify/settings";

export const dynamic = "force-dynamic";

async function requireSettingsAdmin(request: Request, businessId: string) {
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
  const auth = await requireSettingsAdmin(request, businessId);
  if ("error" in auth && auth.error) return auth.error;
  return NextResponse.json({ ok: true, settings: await loadNotificationSettings(businessId) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { businessId?: string; settings?: unknown };
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const auth = await requireSettingsAdmin(request, businessId);
  if ("error" in auth && auth.error) return auth.error;
  const settings = mergeNotificationSettings(body.settings);
  await saveNotificationSettings(businessId, settings);
  return NextResponse.json({ ok: true, settings });
}
