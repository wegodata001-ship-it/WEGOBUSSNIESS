import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { loadProjectEnv, normalizePrivateKey } from "./load-env";

loadProjectEnv();

function sanitize(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED]");
}

async function main() {
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
    console.error("NO_CREDENTIAL");
    process.exit(1);
  }

  const token = await credential.getAccessToken();
  const rules = readFileSync("firestore.rules", "utf8");

  const createResponse = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: {
          files: [{ name: "firestore.rules", content: rules }],
        },
      }),
    },
  );

  if (!createResponse.ok) {
    console.error("RULESET_CREATE", createResponse.status);
    process.exit(1);
  }

  const created = await createResponse.json() as { name?: string };
  if (!created.name) {
    console.error("RULESET_NAME_MISSING");
    process.exit(1);
  }

  const releaseResponse = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore?updateMask=rulesetName`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `projects/${projectId}/releases/cloud.firestore`,
        rulesetName: created.name,
      }),
    },
  );

  if (!releaseResponse.ok) {
    const createRelease = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `projects/${projectId}/releases/cloud.firestore`,
          rulesetName: created.name,
        }),
      },
    );
    if (!createRelease.ok) {
      console.error("RULES_RELEASE", releaseResponse.status, createRelease.status);
      process.exit(1);
    }
  }

  console.log("FIRESTORE_RULES_DEPLOYED", "PASS");
}

main().catch((error) => {
  console.error("DEPLOY_FAILED", sanitize(error));
  process.exit(1);
});
