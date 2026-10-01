import { NextResponse } from "next/server";
import { actorCan, requireActor } from "@/lib/auth/server-actor";
import { probeBrevo, wegoSenderFromList } from "@/lib/mail/brevo";
import { MAIL_BRAND, mailConfig, siteHref } from "@/lib/mail/env";
import { sendEmail, validateMailEnv } from "@/lib/mail/send";

export const dynamic = "force-dynamic";

const TEST_RECIPIENT = "abulieltasneem23@gmail.com";
const BLOCKED_SENDER = /mishkah|mishkat/i;

function publicConfig() {
  const config = mailConfig();
  return {
    provider: config.provider,
    senderName: config.senderName,
    senderEmail: config.senderEmail,
    replyTo: config.replyTo,
    adminEmail: config.adminEmail,
    siteUrl: config.siteUrl,
  };
}

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

  const checked = validateMailEnv();
  const probe = await probeBrevo();
  const wego = wegoSenderFromList(probe.senders);
  return NextResponse.json({
    ok: checked.ok && probe.ok,
    config: publicConfig(),
    wegoSenderVerified: Boolean(wego),
    recommendedSender: wego?.email ?? null,
    connection: {
      status: probe.status,
      code: probe.code,
      message: probe.message,
      reason: !checked.ok ? checked.error : probe.ok ? "READY" : probe.reason,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { businessId?: string; employeeId?: string };
  const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
  if (!businessId) return NextResponse.json({ error: "MISSING_BUSINESS" }, { status: 400 });
  const auth = await requireMailAdmin(request, businessId);
  if ("error" in auth && auth.error) return auth.error;

  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  if (employeeId) {
    const { sendEmployeeNotification } = await import("@/lib/notify/service");
    const sent = await sendEmployeeNotification({
      businessId,
      type: "task.assigned",
      title: "בדיקת התראת עובד",
      message: "זהו מייל בדיקה של מערכת ההתראות.",
      href: "/dashboard",
      employeeIds: [employeeId],
      subject: `${MAIL_BRAND} — בדיקת התראת עובד`,
      dedupeKey: `TEST_EMPLOYEE:${employeeId}:${Date.now()}`,
    });
    return NextResponse.json({
      ok: sent.emails > 0,
      emails: sent.emails,
      inApp: sent.inApp,
      skipped: sent.skipped,
      failed: sent.failed,
      config: publicConfig(),
    }, { status: sent.emails > 0 ? 200 : 502 });
  }

  const checked = validateMailEnv();
  if (!checked.ok) {
    return NextResponse.json({
      ok: false,
      error: checked.error,
      reason: checked.error,
      to: TEST_RECIPIENT,
      config: publicConfig(),
    }, { status: 400 });
  }

  const probe = await probeBrevo();
  const wego = wegoSenderFromList(probe.senders);
  if (probe.ok && (!wego || BLOCKED_SENDER.test(checked.config.senderEmail))) {
    return NextResponse.json({
      ok: false,
      error: "WEGO SENDER NOT VERIFIED",
      reason: "SENDER_NOT_VERIFIED",
      status: probe.status,
      to: TEST_RECIPIENT,
      config: publicConfig(),
    }, { status: 409 });
  }

  const result = await sendEmail({
    to: TEST_RECIPIENT,
    toName: "Tasneem",
    locale: "he",
    subject: `${MAIL_BRAND} — בדיקת מערכת ההתראות`,
    heading: "שלום Tasneem",
    intro: `מערכת ההתראות של ${MAIL_BRAND} מחוברת בהצלחה.\nזהו מייל בדיקה שנשלח ממערכת ${MAIL_BRAND}.`,
    rows: [
      { label: "סטטוס", value: "בדיקת מערכת" },
      { label: "תאריך", value: new Date().toLocaleDateString("he-IL") },
    ],
    ctaLabel: "פתיחה במערכת",
    ctaHref: siteHref("/dashboard"),
  });

  if (!result.ok || !("messageId" in result) || !result.messageId) {
    return NextResponse.json({
      ok: false,
      error: result.ok ? "MAIL_SEND_FAILED" : result.error,
      reason: result.ok ? "MAIL_SEND_FAILED" : result.error,
      status: result.status,
      message: result.ok ? "" : result.message,
      to: TEST_RECIPIENT,
      config: publicConfig(),
    }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    messageId: result.messageId,
    status: result.status,
    sender: result.sender,
    to: TEST_RECIPIENT,
    replyTo: mailConfig().replyTo,
    config: publicConfig(),
  });
}
