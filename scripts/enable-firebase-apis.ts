import { cert, initializeApp } from "firebase-admin/app";
import { loadProjectEnv, normalizePrivateKey } from "./load-env";

function sanitize(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED]");
}

async function main() {
  loadProjectEnv();
  const projectId = (process.env.FIREBASE_ADMIN_PROJECT_ID ?? "").trim();
  const app = initializeApp({
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? ""),
    }),
    projectId,
  });

  const credential = app.options.credential;
  if (!credential || !("getAccessToken" in credential)) {
    console.log("ENABLE_APIS FAIL no-credential");
    return;
  }

  const token = await credential.getAccessToken();
  const services = [
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "securetoken.googleapis.com",
    "storage.googleapis.com",
    "firebasestorage.googleapis.com",
  ];

  for (const service of services) {
    const url = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${service}:enable`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
    });
    console.log("ENABLE", service, response.status);
    if (!response.ok && response.status !== 200 && response.status !== 409) {
      const body = await response.text();
      const safe = body
        .replace(/[A-Za-z0-9_=-]{20,}/g, "[REDACTED]")
        .slice(0, 180);
      console.log("ENABLE_NOTE", service, response.status, safe);
    }
  }
}

main().catch((error) => {
  console.error("ENABLE_FAILED", sanitize(error));
  process.exit(1);
});
