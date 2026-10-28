import { loadProjectEnv } from "./load-env";

loadProjectEnv();

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function cookieHeader(setCookie: string[]) {
  return setCookie
    .map((item) => item.split(";")[0] ?? "")
    .filter(Boolean)
    .join("; ");
}

async function main() {
  const base = (process.env.LIVE_BASE_URL || "http://127.0.0.1:3011").replace(/\/$/, "");
  const email = (process.env.WEGO_TEST_EMAIL || "").trim();
  const password = process.env.WEGO_TEST_PASSWORD || "";
  if (!email || !password) {
    console.log("HTTP_UPLOAD NOT TESTED missing WEGO_TEST_EMAIL/WEGO_TEST_PASSWORD");
    process.exit(2);
  }

  const login = await fetch(`${base}/api/session/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = (await login.json().catch(() => ({}))) as {
    status?: string;
    business?: { id?: string };
    code?: string;
  };
  console.log("LOGIN", login.status, loginBody.status || loginBody.code || "unknown");
  if (!login.ok || loginBody.status !== "ready" || !loginBody.business?.id) {
    console.log("HTTP_UPLOAD NOT TESTED login");
    process.exit(2);
  }
  const cookie = cookieHeader(login.headers.getSetCookie?.() ?? []);
  const businessId = loginBody.business.id;

  const resolve = await fetch(`${base}/api/session/resolve`, {
    headers: { cookie },
    cache: "no-store",
  });
  console.log("SESSION_RESOLVE", resolve.status);

  const meetings = await fetch(`${base}/api/business/records?kind=meetings&businessId=${encodeURIComponent(businessId)}`, {
    headers: { cookie },
    cache: "no-store",
  });
  console.log("MEETINGS", meetings.status);

  const tasks = await fetch(`${base}/api/business/records?kind=tasks&businessId=${encodeURIComponent(businessId)}`, {
    headers: { cookie },
    cache: "no-store",
  });
  const taskPayload = (await tasks.json().catch(() => ({}))) as { data?: Array<{ id?: string }> };
  const taskId = taskPayload.data?.find((item) => item.id)?.id ?? "";
  if (!taskId) {
    console.log("HTTP_UPLOAD NOT TESTED no_task");
    process.exit(2);
  }

  const form = new FormData();
  form.set("businessId", businessId);
  form.set("file", new File([PNG], "probe-upload.png", { type: "image/png" }));
  const upload = await fetch(`${base}/api/business/tasks/${taskId}/attachments`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const uploaded = (await upload.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  console.log("UPLOAD", upload.status, uploaded.ok ? "OK" : uploaded.error || "FAIL");
  if (!upload.ok || !uploaded.id) {
    console.log("HTTP_UPLOAD FAIL");
    process.exit(1);
  }

  const signed = await fetch(`${base}/api/business/tasks/${taskId}/attachments/${uploaded.id}?businessId=${encodeURIComponent(businessId)}`, {
    headers: { cookie },
    cache: "no-store",
  });
  const signedBody = (await signed.json().catch(() => ({}))) as { ok?: boolean; url?: string };
  console.log("SIGNED", signed.status, signedBody.url?.startsWith("https://") ? "OK" : "FAIL");
  if (!signedBody.url) {
    console.log("HTTP_DOWNLOAD NOT TESTED");
    process.exit(1);
  }
  const file = await fetch(signedBody.url);
  console.log("DOWNLOAD", file.status, file.ok ? "OK" : "FAIL");

  const removed = await fetch(`${base}/api/business/tasks/${taskId}/attachments/${uploaded.id}?businessId=${encodeURIComponent(businessId)}`, {
    method: "DELETE",
    headers: { cookie },
  });
  console.log("DELETE", removed.status, removed.ok ? "OK" : "FAIL");
  console.log("HTTP_UPLOAD PASS");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "FAILED";
  console.error("HTTP_UPLOAD FAIL", message.slice(0, 200));
  process.exit(1);
});
