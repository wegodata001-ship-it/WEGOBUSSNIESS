import { getAdminDb } from "@/lib/firebase/admin";
import { businessDocPath, userDocPath } from "@/lib/firebase/paths";
import { ctaForEntity, mailCopy } from "@/lib/mail/copy";
import { siteHref } from "@/lib/mail/env";
import { sendAdminNotification, sendApprovalNotification, sendMeetingNotification, sendTaskNotification } from "@/lib/mail/send";
import { resolveLocale, type Locale } from "@/types/roles";

const ADMIN_EMAIL_TYPES = new Set([
  "task.submitted",
  "task.completed_unpaid",
  "task.overdue",
  "request.created",
  "meeting.created",
  "meeting.rescheduled",
]);

const USER_EMAIL_TYPES = new Set([
  "task.assigned",
  "task.approved",
]);

async function loadUserMail(userId: string) {
  const snap = await getAdminDb().doc(userDocPath(userId)).get();
  const data = snap.data() ?? {};
  return {
    email: typeof data.email === "string" ? data.email.trim() : "",
    name: typeof data.displayName === "string" ? data.displayName : "",
    locale: resolveLocale(data.locale),
  };
}

async function loadBusinessBrand(businessId: string) {
  const snap = await getAdminDb().doc(businessDocPath(businessId)).get();
  const data = snap.data() ?? {};
  return {
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null,
    primaryColor: typeof data.primaryColor === "string" ? data.primaryColor : "#2563EB",
  };
}

export async function sendNotifyEmails(input: {
  type?: string;
  title: string;
  body: string;
  href?: string;
  entityType?: string;
  userIds?: string[];
  businessId: string;
}) {
  const type = input.type ?? "";
  if (!ADMIN_EMAIL_TYPES.has(type) && !USER_EMAIL_TYPES.has(type)) return;
  const brand = await loadBusinessBrand(input.businessId);
  const href = siteHref(input.href || "/dashboard");

  if (ADMIN_EMAIL_TYPES.has(type)) {
    const locale: Locale = "he";
    const payload = {
      locale,
      subject: `${input.title} · WEGO BIZ`,
      heading: input.title,
      intro: input.body,
      ctaLabel: ctaForEntity(input.entityType, locale),
      ctaHref: href,
      logoUrl: brand.logoUrl,
      primaryColor: brand.primaryColor,
    };
    const send = type.startsWith("meeting.")
      ? sendMeetingNotification
      : type === "task.submitted"
        ? sendApprovalNotification
        : sendAdminNotification;
    await send(payload).catch(() => undefined);
  }

  if (USER_EMAIL_TYPES.has(type)) {
    for (const userId of input.userIds ?? []) {
      const user = await loadUserMail(userId);
      if (!user.email) continue;
      const copy = mailCopy(user.locale);
      const locale: "he" | "ar" = user.locale === "ar" ? "ar" : "he";
      const payload = {
        to: user.email,
        toName: user.name,
        locale,
        subject: `${input.title} · WEGO BIZ`,
        heading: input.title,
        intro: input.body,
        rows: [{ label: copy.task, value: input.body }],
        ctaLabel: ctaForEntity(input.entityType, user.locale),
        ctaHref: href,
        logoUrl: brand.logoUrl,
        primaryColor: brand.primaryColor,
      };
      const send = type === "task.approved" ? sendApprovalNotification : sendTaskNotification;
      await send(payload).catch(() => undefined);
    }
  }
}
