import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import {
  getFirebaseAdminStatus,
  isFirebaseAdminConfigured,
  WAITING_FOR_FIREBASE_CONFIG,
} from "@/lib/env";

export { isFirebaseAdminConfigured, WAITING_FOR_FIREBASE_CONFIG };

if (typeof window !== "undefined") {
  throw new Error("Firebase Admin is server-only.");
}

function readAdminRuntimeEnv() {
  return {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    privateKeyBase64: process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64,
    publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    googleAppCreds: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  };
}

export function getNormalizedAdminPrivateKey() {
  const env = readAdminRuntimeEnv();
  let key = (env.privateKey ?? "").trim();
  if (!key && env.privateKeyBase64?.trim()) {
    key = Buffer.from(env.privateKeyBase64.trim(), "base64").toString("utf8").trim();
  }

  if (
    (key.startsWith("\"") && key.endsWith("\""))
    || (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  return key.replace(/\\n/g, "\n").trim();
}

export function getFirebaseAdminReadyState() {
  return getFirebaseAdminStatus();
}

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const env = readAdminRuntimeEnv();
  const projectId = (env.projectId || env.publicProjectId || "").trim();
  const clientEmail = (env.clientEmail || "").trim();
  const privateKey = getNormalizedAdminPrivateKey();
  const storageBucket = (env.storageBucket || "").trim() || undefined;

  if (env.googleAppCreds?.trim()) {
    return initializeApp({
      projectId,
      storageBucket,
    });
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(WAITING_FOR_FIREBASE_CONFIG);
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
      storageBucket,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "init-failed";
    console.error(
      "[FIREBASE_ADMIN_INIT]",
      message.replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED]").slice(0, 200),
    );
    throw new Error(WAITING_FOR_FIREBASE_CONFIG);
  }
}

export function getAdminAuth(): Auth {
  // Lazy-load Auth so session resolve without a cookie never imports jwks-rsa/jose.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require("firebase-admin/auth") as typeof import("firebase-admin/auth");
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
