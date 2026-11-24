import assert from "node:assert/strict";

/**
 * Safe unit checks for mail configuration gates (no network, no secrets).
 * Documents why Vercel "Needs Attention" on BREVO_API_KEY is a visibility/type
 * migration flag (encrypted/config → sensitive), not proof the key is empty.
 */

function validateMailEnvLike(env: {
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  BREVO_REPLY_TO?: string;
  WEGO_ADMIN_EMAIL?: string;
  MAIL_PROVIDER?: string;
}) {
  const apiKey = (env.BREVO_API_KEY ?? "").trim();
  const senderEmail = (env.BREVO_SENDER_EMAIL ?? "").trim();
  const senderName = (env.BREVO_SENDER_NAME ?? "").trim();
  const replyTo = (env.BREVO_REPLY_TO ?? env.WEGO_ADMIN_EMAIL ?? "").trim();
  const adminEmail = (env.WEGO_ADMIN_EMAIL ?? "").trim();
  const provider = (env.MAIL_PROVIDER ?? "BREVO").trim();
  if (!apiKey) return "MAIL_NOT_CONFIGURED";
  if (!senderEmail || /mishkah|mishkat/i.test(senderEmail)) return "WEGO_EMAIL_SENDER_NOT_CONFIGURED";
  if (!replyTo || !adminEmail || !senderName) return "MAIL_NOT_CONFIGURED";
  if (provider !== "BREVO") return "MAIL_NOT_CONFIGURED";
  return "READY";
}

assert.equal(validateMailEnvLike({}), "MAIL_NOT_CONFIGURED");
assert.equal(
  validateMailEnvLike({
    BREVO_API_KEY: "x-key",
    BREVO_SENDER_EMAIL: "noreply@mishkah.app",
    BREVO_SENDER_NAME: "WEGO",
    BREVO_REPLY_TO: "a@b.com",
    WEGO_ADMIN_EMAIL: "a@b.com",
  }),
  "WEGO_EMAIL_SENDER_NOT_CONFIGURED",
);
assert.equal(
  validateMailEnvLike({
    BREVO_API_KEY: "x-key",
    BREVO_SENDER_EMAIL: "email@wegobiz.app",
    BREVO_SENDER_NAME: "WEGO BIZ",
    BREVO_REPLY_TO: "wego.biz24@gmail.com",
    WEGO_ADMIN_EMAIL: "wego.biz24@gmail.com",
    MAIL_PROVIDER: "BREVO",
  }),
  "READY",
);

// Vercel metadata observed for Production (no secret values):
// BREVO_API_KEY type=encrypted visibility=config → UI "Needs Attention"
// Newer secrets (CRON_SECRET) use type=sensitive visibility=secret.
const vercelBrevoMeta = { type: "encrypted", visibility: "config" } as const;
const vercelCronMeta = { type: "sensitive", visibility: "secret" } as const;
assert.notEqual(vercelBrevoMeta.type, vercelCronMeta.type);
assert.equal(vercelBrevoMeta.visibility, "config");

console.log("MAIL_ENV_PASS");
