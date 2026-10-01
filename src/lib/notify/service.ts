import { createHash } from "node:crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  businessMembersPath,
  employeeDocPath,
  notificationDeliveriesPath,
  notificationDeliveryDocPath,
  notificationsPath,
  userDocPath,
} from "@/lib/firebase/paths";
import { ctaForEntity, mailCopy } from "@/lib/mail/copy";
import { MAIL_BRAND, mailConfig, siteHref } from "@/lib/mail/env";
import { sendEmail, type SendEmailResult } from "@/lib/mail/send";
import type { MailRow } from "@/lib/mail/template";
import { inferAudience, isCriticalEmail, settingKeyFor, type NotifyAudience } from "@/lib/notify/catalog";
import { loadNotificationSettings } from "@/lib/notify/settings";
import { resolveLocale, type Locale } from "@/types/roles";

export type NotifyInput = {
  businessId: string;
  type: string;
  title: string;
  message: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  audience?: NotifyAudience;
  userIds?: string[];
  employeeIds?: string[];
  skipUserIds?: string[];
  rows?: MailRow[];
  subject?: string;
  dedupeKey?: string;
  channels?: { inApp?: boolean; email?: boolean };
};

export type DeliveryStatus = "SENT" | "FAILED" | "SKIPPED_NO_EMAIL" | "SKIPPED_DEDUPE" | "SKIPPED_PREF";

export type NotificationServiceResult = {
  inApp: number;
  emails: number;
  skipped: number;
  failed: number;
};

type UserMail = {
  userId: string;
  email: string;
  name: string;
  locale: Locale;
  notifyInApp: boolean;
  notifyEmail: boolean;
};

function deliveryId(businessId: string, dedupeKey: string, channel: string) {
  return createHash("sha1").update(`${businessId}|${dedupeKey}|${channel}`).digest("hex");
}

async function loadUserMail(userId: string): Promise<UserMail> {
  const snap = await getAdminDb().doc(userDocPath(userId)).get();
  const data = snap.data() ?? {};
  return {
    userId,
    email: typeof data.email === "string" ? data.email.trim() : "",
    name: typeof data.displayName === "string" ? data.displayName : "",
    locale: resolveLocale(data.locale),
    notifyInApp: data.notifyInApp !== false,
    notifyEmail: data.notifyEmail !== false,
  };
}

async function employeeToUserId(businessId: string, employeeId: string) {
  const snap = await getAdminDb().doc(employeeDocPath(businessId, employeeId)).get();
  const data = snap.data() ?? {};
  const userId = typeof data.userId === "string" ? data.userId : typeof data.uid === "string" ? data.uid : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  return { userId, email, name: typeof data.displayName === "string" ? data.displayName : "" };
}

export async function resolveManagerUserIds(businessId: string) {
  const snap = await getAdminDb().collection(businessMembersPath(businessId)).get();
  return snap.docs
    .filter((docSnap) => {
      const data = docSnap.data();
      return data.isActive !== false && (data.role === "BUSINESS_OWNER" || data.role === "MANAGER");
    })
    .map((docSnap) => (typeof docSnap.data().userId === "string" ? docSnap.data().userId as string : docSnap.id));
}

async function resolveUserIds(input: NotifyInput) {
  const skip = new Set((input.skipUserIds ?? []).filter(Boolean));
  const fromUsers = input.userIds ?? [];
  const fromEmployees = await Promise.all((input.employeeIds ?? []).map((id) => employeeToUserId(input.businessId, id)));
  return [...new Set([...fromUsers, ...fromEmployees.map((item) => item.userId)].filter((id) => id && !skip.has(id)))];
}

async function writeDelivery(input: {
  businessId: string;
  id: string;
  notificationId: string | null;
  channel: "IN_APP" | "EMAIL";
  recipient: string;
  status: DeliveryStatus;
  type: string;
  subject: string;
  providerMessageId?: string;
  errorCode?: string;
  attemptCount: number;
}) {
  const now = new Date();
  await getAdminDb().doc(notificationDeliveryDocPath(input.businessId, input.id)).set({
    businessId: input.businessId,
    notificationId: input.notificationId,
    channel: input.channel,
    recipient: input.recipient,
    status: input.status,
    provider: input.channel === "EMAIL" ? "BREVO" : "IN_APP",
    providerMessageId: input.providerMessageId ?? null,
    attemptCount: input.attemptCount,
    type: input.type,
    subject: input.subject,
    sentAt: input.status === "SENT" ? now : null,
    failedAt: input.status === "FAILED" ? now : null,
    errorCode: input.errorCode ?? null,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
}

async function existingDelivery(businessId: string, id: string) {
  const snap = await getAdminDb().doc(notificationDeliveryDocPath(businessId, id)).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    status: typeof data.status === "string" ? data.status : "",
    attemptCount: typeof data.attemptCount === "number" ? data.attemptCount : 0,
  };
}

export async function createNotification(input: {
  businessId: string;
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
}) {
  if (input.dedupeKey) {
    const id = deliveryId(input.businessId, input.dedupeKey, "IN_APP");
    const existing = await existingDelivery(input.businessId, id);
    if (existing?.status === "SENT") return { id: null, skipped: true as const };
  }
  const ref = await getAdminDb().collection(notificationsPath(input.businessId)).add({
    businessId: input.businessId,
    userId: input.recipientUserId,
    type: input.type,
    title: input.title,
    body: input.message,
    href: input.href ?? "/notifications",
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    isRead: false,
    read: false,
    createdAt: new Date(),
  });
  if (input.dedupeKey) {
    await writeDelivery({
      businessId: input.businessId,
      id: deliveryId(input.businessId, input.dedupeKey, "IN_APP"),
      notificationId: ref.id,
      channel: "IN_APP",
      recipient: input.recipientUserId,
      status: "SENT",
      type: input.type,
      subject: input.title,
      attemptCount: 1,
    });
  }
  return { id: ref.id, skipped: false as const };
}

export async function sendEmailNotification(input: {
  businessId: string;
  to: string;
  toName?: string;
  locale: "he" | "ar";
  subject: string;
  heading: string;
  intro?: string;
  rows?: MailRow[];
  href?: string;
  entityType?: string;
  type: string;
  notificationId?: string | null;
  dedupeKey?: string;
}): Promise<{ status: DeliveryStatus; messageId?: string; error?: string }> {
  const key = input.dedupeKey || `${input.type}:${input.to}:${input.subject}`;
  const id = deliveryId(input.businessId, key, "EMAIL");
  const existing = await existingDelivery(input.businessId, id);
  if (existing?.status === "SENT") return { status: "SKIPPED_DEDUPE" };
  const attemptCount = (existing?.attemptCount ?? 0) + 1;
  if (!input.to || !input.to.includes("@")) {
    await writeDelivery({
      businessId: input.businessId,
      id,
      notificationId: input.notificationId ?? null,
      channel: "EMAIL",
      recipient: input.to || "",
      status: "SKIPPED_NO_EMAIL",
      type: input.type,
      subject: input.subject,
      attemptCount,
      errorCode: "SKIPPED_NO_EMAIL",
    });
    return { status: "SKIPPED_NO_EMAIL" };
  }

  const locale = input.locale === "ar" ? "ar" : "he";
  const result: SendEmailResult = await sendEmail({
    to: input.to,
    toName: input.toName,
    locale,
    subject: input.subject,
    heading: input.heading,
    intro: input.intro,
    rows: input.rows,
    ctaLabel: ctaForEntity(input.entityType, locale),
    ctaHref: siteHref(input.href || "/dashboard"),
  });

  if (!result.ok || !result.messageId) {
    await writeDelivery({
      businessId: input.businessId,
      id,
      notificationId: input.notificationId ?? null,
      channel: "EMAIL",
      recipient: input.to,
      status: "FAILED",
      type: input.type,
      subject: input.subject,
      attemptCount,
      errorCode: result.ok ? "MAIL_SEND_FAILED" : result.error,
    });
    return { status: "FAILED", error: result.ok ? "MAIL_SEND_FAILED" : result.error };
  }

  await writeDelivery({
    businessId: input.businessId,
    id,
    notificationId: input.notificationId ?? null,
    channel: "EMAIL",
    recipient: input.to,
    status: "SENT",
    type: input.type,
    subject: input.subject,
    attemptCount,
    providerMessageId: result.messageId,
  });
  return { status: "SENT", messageId: result.messageId };
}

export async function sendNotification(input: NotifyInput): Promise<NotificationServiceResult> {
  const audience = input.audience ?? inferAudience(input.type);
  const settings = await loadNotificationSettings(input.businessId);
  const settingKey = settingKeyFor(input.type, audience);
  const pref = audience === "ADMIN"
    ? settings.admin[settingKey as keyof typeof settings.admin]
    : settings.employee[settingKey as keyof typeof settings.employee];
  const inApp = input.channels?.inApp ?? pref?.inApp ?? true;
  const emailOn = input.channels?.email ?? pref?.email ?? false;

  const userIds = audience === "ADMIN" && !input.userIds && !input.employeeIds
    ? (await resolveManagerUserIds(input.businessId)).filter((id) => !(input.skipUserIds ?? []).includes(id))
    : await resolveUserIds(input);

  const result: NotificationServiceResult = { inApp: 0, emails: 0, skipped: 0, failed: 0 };

  for (const userId of userIds) {
    const user = await loadUserMail(userId);
    if (!user.email && input.employeeIds?.length) {
      const match = await Promise.all((input.employeeIds ?? []).map((id) => employeeToUserId(input.businessId, id)));
      const extra = match.find((item) => item.userId === userId && item.email);
      if (extra) {
        user.email = extra.email;
        if (!user.name) user.name = extra.name;
      }
    }

    let notificationId: string | null = null;
    if (inApp && user.notifyInApp) {
      const created = await createNotification({
        businessId: input.businessId,
        recipientUserId: userId,
        type: input.type,
        title: input.title,
        message: input.message,
        href: input.href,
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : undefined,
      });
      if (created.skipped) result.skipped += 1;
      else {
        result.inApp += 1;
        notificationId = created.id;
      }
    } else if (inApp && !user.notifyInApp) {
      result.skipped += 1;
    }

    if (audience === "EMPLOYEE" && emailOn) {
      if (!user.notifyEmail && !isCriticalEmail(input.type)) {
        result.skipped += 1;
        continue;
      }
      const locale = user.locale === "ar" ? "ar" : "he";
      const labels = mailCopy(locale);
      const sent = await sendEmailNotification({
        businessId: input.businessId,
        to: user.email,
        toName: user.name,
        locale,
        subject: input.subject || `${MAIL_BRAND} — ${input.title}`,
        heading: input.title,
        intro: input.message,
        rows: input.rows?.length ? input.rows : [{ label: labels.task, value: input.message }],
        href: input.href,
        entityType: input.entityType,
        type: input.type,
        notificationId,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : undefined,
      });
      if (sent.status === "SENT") result.emails += 1;
      else if (sent.status === "FAILED") result.failed += 1;
      else result.skipped += 1;
    }
  }

  if (audience === "ADMIN" && emailOn) {
    const adminEmail = mailConfig().adminEmail;
    const sent = await sendEmailNotification({
      businessId: input.businessId,
      to: adminEmail,
      toName: MAIL_BRAND,
      locale: "he",
      subject: input.subject || `${MAIL_BRAND} — ${input.title}`,
      heading: input.title,
      intro: input.message,
      rows: input.rows,
      href: input.href,
      entityType: input.entityType,
      type: input.type,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:admin` : `${input.type}:${input.entityId || "none"}:admin`,
    });
    if (sent.status === "SENT") result.emails += 1;
    else if (sent.status === "FAILED") result.failed += 1;
    else result.skipped += 1;
  }

  return result;
}

export async function sendAdminNotification(input: Omit<NotifyInput, "audience">) {
  return sendNotification({ ...input, audience: "ADMIN" });
}

export async function sendEmployeeNotification(input: Omit<NotifyInput, "audience">) {
  return sendNotification({ ...input, audience: "EMPLOYEE" });
}

export async function markAsRead(input: { businessId: string; userId: string; id?: string; all?: boolean }) {
  const db = getAdminDb();
  if (input.all) {
    const snap = await db.collection(notificationsPath(input.businessId)).where("userId", "==", input.userId).get();
    await Promise.all(snap.docs
      .filter((docSnap) => !docSnap.data().isRead)
      .map((docSnap) => docSnap.ref.set({ isRead: true, read: true }, { merge: true })));
    return;
  }
  if (!input.id) return;
  const { notificationDocPath } = await import("@/lib/firebase/paths");
  const ref = db.doc(notificationDocPath(input.businessId, input.id));
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.userId !== input.userId) return;
  await ref.set({ isRead: true, read: true }, { merge: true });
}

export async function scheduleReminder(input: {
  businessId: string;
  type: string;
  entityType: string;
  entityId: string;
  runAt: Date;
  payload: Record<string, unknown>;
}) {
  await getAdminDb().collection(`${notificationDeliveriesPath(input.businessId)}`).add({
    businessId: input.businessId,
    channel: "SCHEDULE",
    status: "PENDING",
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    runAt: input.runAt,
    payload: input.payload,
    createdAt: new Date(),
  });
}

export async function retryFailedDelivery(businessId: string, deliveryId: string) {
  const snap = await getAdminDb().doc(notificationDeliveryDocPath(businessId, deliveryId)).get();
  if (!snap.exists) return { ok: false as const, error: "NOT_FOUND" };
  const data = snap.data() ?? {};
  if (data.channel !== "EMAIL" || data.status !== "FAILED") return { ok: false as const, error: "NOT_RETRYABLE" };
  const recipient = typeof data.recipient === "string" ? data.recipient : "";
  const subject = typeof data.subject === "string" ? data.subject : `${MAIL_BRAND}`;
  const type = typeof data.type === "string" ? data.type : "general";
  const sent = await sendEmailNotification({
    businessId,
    to: recipient,
    locale: "he",
    subject,
    heading: subject,
    intro: subject,
    type,
    dedupeKey: `retry:${deliveryId}:${new Date().toISOString().slice(0, 13)}`,
  });
  return { ok: sent.status === "SENT", status: sent.status, messageId: sent.messageId, error: sent.error };
}
