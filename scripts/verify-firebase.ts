import { initializeApp as initializeAdminApp, cert, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getStorage as getAdminStorage } from "firebase-admin/storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { loadProjectEnv, normalizePrivateKey } from "./load-env";

const REQUIRED_CLIENT = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const REQUIRED_ADMIN = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
] as const;

type Status = "PASS" | "FAIL" | "NEEDS_ENABLE" | "NEEDS_CREATION";

const results: Record<string, Status> = {};
const notes: string[] = [];

function envValue(name: string) {
  return process.env[name] ?? "";
}

function present(name: string) {
  return Boolean(envValue(name).trim());
}

function sanitize(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED]")
    .replace(/private[_-]?key[^\n]*/gi, "private_key=[REDACTED]");
}

function mark(name: string, status: Status, note?: string) {
  results[name] = status;
  if (note) notes.push(`${name}: ${note}`);
}

async function main() {
  const envFileLoaded = loadProjectEnv();
  if (!envFileLoaded) {
    mark("ENV_LOADED", "FAIL", ".env.local is missing");
  }

  const missing = [...REQUIRED_CLIENT, ...REQUIRED_ADMIN].filter((key) => !present(key));
  mark(
    "ENV_LOADED",
    envFileLoaded && missing.length === 0 ? "PASS" : "FAIL",
    missing.length ? `missing keys: ${missing.join(", ")}` : undefined,
  );

  const clientProjectId = envValue("NEXT_PUBLIC_FIREBASE_PROJECT_ID").trim();
  const adminProjectId = envValue("FIREBASE_ADMIN_PROJECT_ID").trim();
  mark(
    "CLIENT_PROJECT_ID_MATCH",
    clientProjectId && adminProjectId && clientProjectId === adminProjectId ? "PASS" : "FAIL",
    clientProjectId && adminProjectId && clientProjectId !== adminProjectId
      ? "FIREBASE_ADMIN_PROJECT_ID does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID"
      : undefined,
  );

  const privateKey = normalizePrivateKey(envValue("FIREBASE_ADMIN_PRIVATE_KEY"));
  const privateKeyOk = privateKey.includes("BEGIN PRIVATE KEY")
    && privateKey.includes("END PRIVATE KEY")
    && privateKey.includes("\n");
  mark(
    "PRIVATE_KEY_FORMAT",
    privateKeyOk ? "PASS" : "FAIL",
    privateKeyOk
      ? undefined
      : "FIREBASE_ADMIN_PRIVATE_KEY must be a quoted Service Account key with BEGIN/END markers",
  );

  try {
    const config = {
      apiKey: envValue("NEXT_PUBLIC_FIREBASE_API_KEY"),
      authDomain: envValue("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
      projectId: clientProjectId,
      storageBucket: envValue("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
      messagingSenderId: envValue("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
      appId: envValue("NEXT_PUBLIC_FIREBASE_APP_ID"),
    };
    const app = getApps().length ? getApp() : initializeApp(config);
    getAuth(app);
    getFirestore(app);
    getStorage(app);
    mark("FIREBASE_CLIENT_INIT", "PASS");
  } catch (error) {
    mark("FIREBASE_CLIENT_INIT", "FAIL", sanitize(error));
  }

  try {
    const app = getAdminApps().length
      ? getAdminApps()[0]!
      : initializeAdminApp({
          credential: cert({
            projectId: adminProjectId,
            clientEmail: envValue("FIREBASE_ADMIN_CLIENT_EMAIL"),
            privateKey,
          }),
          projectId: adminProjectId,
          storageBucket: envValue("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
        });

    getAdminAuth(app);
    getAdminFirestore(app);
    mark("FIREBASE_ADMIN_INIT", "PASS");

    try {
      await getAdminAuth(app).listUsers(1);
      mark("FIREBASE_AUTH", "PASS");
    } catch (error) {
      mark("FIREBASE_AUTH", "FAIL", sanitize(error));
    }

    try {
      await getAdminFirestore(app).collection("businesses").limit(1).get();
      mark("FIRESTORE", "PASS");
      mark("FIRESTORE_READ_TEST", "PASS");
    } catch (error) {
      const message = sanitize(error);
      const needsCreation = /NOT_FOUND|does not exist|404/i.test(message);
      mark("FIRESTORE", needsCreation ? "NEEDS_CREATION" : "FAIL", message);
      mark("FIRESTORE_READ_TEST", "FAIL", message);
    }

    try {
      const bucketName = envValue("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET").trim();
      if (!bucketName) {
        mark("STORAGE", "FAIL", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is empty");
      } else {
        const [exists] = await getAdminStorage(app).bucket(bucketName).exists();
        mark(
          "STORAGE",
          exists ? "PASS" : "FAIL",
          exists ? undefined : `Storage bucket is not available: ${bucketName ? "configured name present" : "missing"}`,
        );
      }
    } catch (error) {
      mark("STORAGE", "FAIL", sanitize(error));
    }

    try {
      const credential = app.options.credential;
      if (!credential || !("getAccessToken" in credential)) {
        mark("EMAIL_PASSWORD_AUTH", "NEEDS_ENABLE", "Could not inspect Identity Toolkit config");
      } else {
        const token = await credential.getAccessToken();
        const response = await fetch(
          `https://identitytoolkit.googleapis.com/admin/v2/projects/${adminProjectId}/config`,
          { headers: { Authorization: `Bearer ${token.access_token}` } },
        );

        if (!response.ok) {
          mark(
            "EMAIL_PASSWORD_AUTH",
            "NEEDS_ENABLE",
            `Identity Toolkit config check returned ${response.status}`,
          );
        } else {
          const config = await response.json() as {
            signIn?: { email?: { enabled?: boolean } };
          };
          mark(
            "EMAIL_PASSWORD_AUTH",
            config.signIn?.email?.enabled ? "PASS" : "NEEDS_ENABLE",
          );
        }
      }
    } catch (error) {
      mark("EMAIL_PASSWORD_AUTH", "NEEDS_ENABLE", sanitize(error));
    }
  } catch (error) {
    mark("FIREBASE_ADMIN_INIT", "FAIL", sanitize(error));
    mark("FIREBASE_AUTH", "FAIL");
    mark("FIRESTORE", "FAIL");
    mark("FIRESTORE_READ_TEST", "FAIL");
    mark("STORAGE", "FAIL");
    mark("EMAIL_PASSWORD_AUTH", "NEEDS_ENABLE");
  }

  const connected = results.FIREBASE_CLIENT_INIT === "PASS"
    && results.FIREBASE_ADMIN_INIT === "PASS"
    && (results.FIRESTORE === "PASS" || results.FIRESTORE === "NEEDS_CREATION" ? results.FIRESTORE === "PASS" : false);

  console.log("ENV_LOADED", results.ENV_LOADED);
  console.log("CLIENT_PROJECT_ID_MATCH", results.CLIENT_PROJECT_ID_MATCH);
  console.log("FIREBASE_CLIENT_INIT", results.FIREBASE_CLIENT_INIT);
  console.log("FIREBASE_ADMIN_INIT", results.FIREBASE_ADMIN_INIT);
  console.log("FIREBASE_AUTH", results.FIREBASE_AUTH);
  console.log("EMAIL_PASSWORD_AUTH", results.EMAIL_PASSWORD_AUTH);
  console.log("FIRESTORE", results.FIRESTORE);
  console.log("FIRESTORE_READ_TEST", results.FIRESTORE_READ_TEST);
  console.log("STORAGE", results.STORAGE);
  console.log("PRIVATE_KEY_FORMAT", results.PRIVATE_KEY_FORMAT);
  console.log("FIREBASE_CONNECTION", connected ? "CONNECTED" : "NOT_CONNECTED");
  for (const note of notes) {
    console.log(`NOTE ${note}`);
  }
}

main().catch((error) => {
  console.error("VERIFY_FAILED", sanitize(error));
  process.exit(1);
});
