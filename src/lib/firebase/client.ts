import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  getClientFirebaseConfig,
  getFirebaseClientStatus,
  isFirebaseClientConfigured,
  WAITING_FOR_FIREBASE_CONFIG,
} from "@/lib/env";

export { isFirebaseClientConfigured, WAITING_FOR_FIREBASE_CONFIG };

export function getFirebaseClientReadyState() {
  return getFirebaseClientStatus();
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error(WAITING_FOR_FIREBASE_CONFIG);
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getClientFirebaseConfig());
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
