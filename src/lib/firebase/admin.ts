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

const ADMIN_RUNTIME_ENV = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  privateKeyBase64: process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64,
  publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  googleAppCreds: process.env.GOOGLE_APPLICATION_CREDENTIALS,
};

export function getNormalizedAdminPrivateKey() {
  let key = (ADMIN_RUNTIME_ENV.privateKey ?? "").trim();
  if (!key && ADMIN_RUNTIME_ENV.privateKeyBase64?.trim()) {
    key = Buffer.from(ADMIN_RUNTIME_ENV.privateKeyBase64.trim(), "base64").toString("utf8").trim();
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

  const projectId = (ADMIN_RUNTIME_ENV.projectId || ADMIN_RUNTIME_ENV.publicProjectId || "").trim();
  const clientEmail = (ADMIN_RUNTIME_ENV.clientEmail || "").trim();
  const privateKey = getNormalizedAdminPrivateKey();
  const storageBucket = (ADMIN_RUNTIME_ENV.storageBucket || "").trim() || undefined;

  if (ADMIN_RUNTIME_ENV.googleAppCreds?.trim()) {
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
  } catch {
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
