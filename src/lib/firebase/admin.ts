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

export function getNormalizedAdminPrivateKey() {
  let key = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").trim();

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
  if (!isFirebaseAdminConfigured()) {
    throw new Error(WAITING_FOR_FIREBASE_CONFIG);
  }

  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return initializeApp({
      projectId,
      storageBucket,
    });
  }

  try {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: getNormalizedAdminPrivateKey(),
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
