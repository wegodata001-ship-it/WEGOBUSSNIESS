import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnv(name) {
  const line = readFileSync(resolve(process.cwd(), ".env"), "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const key = readEnv("BREVO_API_KEY");
const sender = readEnv("BREVO_SENDER_EMAIL");
const base = (readEnv("BREVO_BASE_URL") || "https://api.brevo.com/v3").replace(/\/$/, "");
console.log("SENDER_ENV", sender || "(empty)");
if (!key) {
  console.log("LOCAL_BREVO: FAIL MAIL_NOT_CONFIGURED");
  process.exit(1);
}

const account = await fetch(`${base}/account`, {
  headers: { accept: "application/json", "api-key": key },
});
const accountBody = await account.json().catch(() => ({}));
console.log("ACCOUNT_HTTP", account.status);
console.log("ACCOUNT_CODE", accountBody.code || "");
console.log("ACCOUNT_MESSAGE", typeof accountBody.message === "string" ? accountBody.message : "");

if (!account.ok) {
  const text = `${accountBody.code || ""} ${accountBody.message || ""}`.toLowerCase();
  console.log("IP_ALLOWLIST", text.includes("ip") ? "BLOCKED" : "UNKNOWN");
  console.log("LOCAL_BREVO: FAIL");
  process.exit(1);
}

const sendersRes = await fetch(`${base}/senders`, {
  headers: { accept: "application/json", "api-key": key },
});
const sendersBody = await sendersRes.json().catch(() => ({}));
const senders = Array.isArray(sendersBody.senders) ? sendersBody.senders : [];
console.log("SENDERS_HTTP", sendersRes.status);
console.log("SENDERS", senders.map((item) => `${item.email}:${item.active !== false ? "active" : "inactive"}`).join(",") || "(none)");
const gmail = senders.find((item) => String(item.email || "").toLowerCase() === "wego.biz24@gmail.com" && item.active !== false);
const wegoApp = senders.find((item) => String(item.email || "").toLowerCase() === "email@wegobiz.app" && item.active !== false);
console.log("GMAIL_SENDER_VERIFIED", gmail ? "YES" : "NO");
console.log("WEGO_APP_SENDER_VERIFIED", wegoApp ? "YES" : "NO");
console.log("WEGO_SENDER_VERIFIED", wegoApp || gmail ? "YES" : "NO");
console.log("LOCAL_BREVO: PASS");
