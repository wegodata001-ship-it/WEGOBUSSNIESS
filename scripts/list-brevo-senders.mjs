import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnv(name) {
  const line = readFileSync(resolve(process.cwd(), ".env"), "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const key = readEnv("BREVO_API_KEY");
const base = (readEnv("BREVO_BASE_URL") || "https://api.brevo.com/v3").replace(/\/$/, "");
if (!key) {
  console.log("MISSING_BREVO_API_KEY");
  process.exit(1);
}

const response = await fetch(`${base}/senders`, {
  headers: { accept: "application/json", "api-key": key },
});
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.log("BREVO_SENDERS_FAILED", response.status);
  process.exit(1);
}
const senders = Array.isArray(payload.senders) ? payload.senders : [];
console.log(JSON.stringify(senders.map((item) => ({
  email: item.email,
  name: item.name,
  active: item.active,
  verified: item.verified,
})), null, 2));
