import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnv(name) {
  const line = readFileSync(resolve(process.cwd(), ".env"), "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const apiKey = readEnv("BREVO_API_KEY");
const base = (readEnv("BREVO_BASE_URL") || "https://api.brevo.com/v3").replace(/\/$/, "");
const senderName = readEnv("BREVO_SENDER_NAME") || "WEGO BIZ";
const senderEmail = readEnv("BREVO_SENDER_EMAIL");
const replyTo = readEnv("BREVO_REPLY_TO") || readEnv("WEGO_ADMIN_EMAIL");
const siteUrl = (readEnv("NEXT_PUBLIC_SITE_URL") || "").replace(/\/$/, "");
const to = "abulieltasneem23@gmail.com";

if (!apiKey || !senderEmail) {
  console.log("MAIL_NOT_CONFIGURED");
  process.exit(1);
}

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<body style="margin:0;background:#F6F8FC;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #E2E8F0;">
        <tr><td style="background:#0F172A;padding:20px 24px;color:#fff;">
          <div style="font-size:18px;font-weight:700;">WEGO BIZ</div>
          <div style="font-size:12px;color:#94A3B8;">Business Management</div>
        </td></tr>
        <tr><td style="padding:28px 24px;text-align:right;">
          <h1 style="margin:0 0 16px;font-size:22px;">שלום Tasneem</h1>
          <p style="margin:0 0 12px;line-height:1.6;">מערכת ההתראות של WEGO BIZ מחוברת בהצלחה.</p>
          <p style="margin:0 0 20px;line-height:1.6;">זהו מייל בדיקה שנשלח ממערכת WEGO BIZ.</p>
          <a href="${siteUrl}/dashboard" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700;">פתיחה במערכת</a>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:16px 24px;border-top:1px solid #E2E8F0;text-align:right;">
          <div style="font-weight:700;">WEGO BIZ</div>
          <div style="font-size:12px;color:#64748B;">Business Management</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const response = await fetch(`${base}/smtp/email`, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": apiKey,
  },
  body: JSON.stringify({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name: "Tasneem" }],
    replyTo: replyTo ? { email: replyTo, name: senderName } : undefined,
    subject: "WEGO BIZ — בדיקת מערכת ההתראות",
    htmlContent: html,
    textContent: [
      "WEGO BIZ",
      "Business Management",
      "",
      "שלום Tasneem",
      "מערכת ההתראות של WEGO BIZ מחוברת בהצלחה.",
      "זהו מייל בדיקה שנשלח ממערכת WEGO BIZ.",
      `${siteUrl}/dashboard`,
    ].join("\n"),
  }),
});

const payload = await response.json().catch(() => ({}));
if (!response.ok || !payload.messageId) {
  console.log("TEST_EMAIL: FAIL");
  console.log("STATUS", response.status);
  process.exit(1);
}
console.log("TEST_EMAIL: PASS");
console.log("TO", to);
console.log("SENDER", senderEmail);
console.log("REPLY_TO", replyTo);
console.log("SUBJECT", "WEGO BIZ — בדיקת מערכת ההתראות");
console.log("SITE_URL", siteUrl);
console.log("MESSAGE_ID", payload.messageId);
