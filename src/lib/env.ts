import { resolveLocale, type Locale } from "@/types/roles";

export const PUBLIC_FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export const ADMIN_FIREBASE_ENV_KEYS = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
] as const;

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "WEGO Business";

export const DEFAULT_TIMEZONE =
  process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Asia/Jerusalem";

export const DEFAULT_LOCALE: Locale = resolveLocale(
  process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
);

export const SUPPORTED_LOCALES = (
  process.env.NEXT_PUBLIC_SUPPORTED_LOCALES ?? "he,ar"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

export const WAITING_FOR_FIREBASE_CONFIG = "WAITING_FOR_FIREBASE_CONFIG" as const;

export function missingPublicFirebaseEnv(): string[] {
  return PUBLIC_FIREBASE_ENV_KEYS.filter((key) => !process.env[key]?.trim());
}

export function missingAdminFirebaseEnv(): string[] {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return [];
  }

  const present = {
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY:
      process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64,
  };

  return ADMIN_FIREBASE_ENV_KEYS.filter((key) => !present[key]?.trim());
}

export function isFirebaseClientConfigured(): boolean {
  return missingPublicFirebaseEnv().length === 0;
}

export function isFirebaseAdminConfigured(): boolean {
  return missingAdminFirebaseEnv().length === 0;
}

export function getFirebaseClientStatus() {
  return isFirebaseClientConfigured() ? "READY" : WAITING_FOR_FIREBASE_CONFIG;
}

export function getFirebaseAdminStatus() {
  return isFirebaseAdminConfigured() ? "READY" : WAITING_FOR_FIREBASE_CONFIG;
}

export function readEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

export function getFirebaseWebApiKey() {
  // Static FIREBASE_WEB_API_KEY access is required so Next.js injects it into the lambda.
  const serverOnly = (process.env.FIREBASE_WEB_API_KEY ?? "").trim();
  if (serverOnly) return serverOnly;
  return (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "").trim();
}

export function getClientFirebaseConfig() {
  return {
    apiKey: getFirebaseWebApiKey(),
    authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };
}
