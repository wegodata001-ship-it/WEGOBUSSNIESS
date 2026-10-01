import "server-only";
import { brevoRequest, type BrevoReason } from "@/lib/mail/brevo";
import { isMailConfigured, mailConfig } from "@/lib/mail/env";
import { renderWegoMail, type MailTemplateInput } from "@/lib/mail/template";

export type SendEmailInput = MailTemplateInput & {
  to: string;
  toName?: string;
  subject: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string; sender: string; status: number }
  | { ok: false; error: BrevoReason; status: number; message: string };

function blockedSender(email: string) {
  return /mishkah|mishkat/i.test(email);
}

export function validateMailEnv() {
  const config = mailConfig();
  if (!config.apiKey) return { ok: false as const, error: "MAIL_NOT_CONFIGURED" as BrevoReason };
  if (!config.senderEmail || blockedSender(config.senderEmail)) {
    return { ok: false as const, error: "WEGO_EMAIL_SENDER_NOT_CONFIGURED" as BrevoReason };
  }
  if (!config.replyTo || !config.adminEmail || !config.senderName) {
    return { ok: false as const, error: "MAIL_NOT_CONFIGURED" as BrevoReason };
  }
  return { ok: true as const, config };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const checked = validateMailEnv();
  if (!checked.ok) {
    return { ok: false, error: checked.error, status: 0, message: checked.error };
  }
  if (!isMailConfigured()) {
    return { ok: false, error: "MAIL_NOT_CONFIGURED", status: 0, message: "MAIL_NOT_CONFIGURED" };
  }
  const to = input.to.trim();
  if (!to || !to.includes("@")) {
    return { ok: false, error: "INVALID_RECIPIENT", status: 0, message: "INVALID_RECIPIENT" };
  }

  const rendered = renderWegoMail(input);
  const config = checked.config;
  const result = await brevoRequest("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: to, name: input.toName || to }],
      replyTo: config.replyTo ? { email: config.replyTo, name: config.senderName } : undefined,
      subject: input.subject,
      htmlContent: rendered.html,
      textContent: rendered.text,
    }),
  });
  const messageId = typeof result.payload.messageId === "string" ? result.payload.messageId : "";
  if (!result.ok || !messageId) {
    return {
      ok: false,
      error: result.reason,
      status: result.status,
      message: result.message || result.code || result.reason,
    };
  }
  return { ok: true, messageId, sender: config.senderEmail, status: result.status };
}

export async function sendAdminNotification(input: Omit<SendEmailInput, "to"> & { to?: string }) {
  const config = mailConfig();
  const to = (input.to || config.adminEmail).trim();
  if (!to) return { ok: false as const, error: "MAIL_NOT_CONFIGURED" as BrevoReason, status: 0, message: "MAIL_NOT_CONFIGURED" };
  return sendEmail({ ...input, to });
}

export async function sendTaskNotification(input: SendEmailInput) {
  return sendEmail(input);
}

export async function sendMeetingNotification(input: Omit<SendEmailInput, "to"> & { to?: string }) {
  return sendAdminNotification(input);
}

export async function sendApprovalNotification(input: Omit<SendEmailInput, "to"> & { to?: string }) {
  return sendAdminNotification(input);
}
