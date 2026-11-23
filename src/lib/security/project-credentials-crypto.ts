import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

export const PROJECT_CREDENTIALS_KEY_ENV = "PROJECT_CREDENTIALS_ENCRYPTION_KEY";
export const PROJECT_CREDENTIALS_ALGO = "aes-256-gcm";
export const PROJECT_CREDENTIALS_KEY_VERSION = "v1";

export type EncryptedProjectSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
  algorithm: typeof PROJECT_CREDENTIALS_ALGO;
};

function readRawKey() {
  return (process.env[PROJECT_CREDENTIALS_KEY_ENV] ?? "").trim();
}

/** Accepts base64 (32 bytes) or hex (64 chars). */
export function parseProjectCredentialsKey(raw = readRawKey()): Buffer | null {
  if (!raw) return null;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      const key = Buffer.from(raw, "hex");
      return key.length === 32 ? key : null;
    }
    const key = Buffer.from(raw, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function isProjectCredentialsEncryptionConfigured() {
  return Boolean(parseProjectCredentialsKey());
}

export function projectCredentialAad(businessId: string, projectId: string) {
  return Buffer.from(`wego:project-credential:v1:${businessId}:${projectId}`, "utf8");
}

export function encryptProjectPassword(input: {
  plaintext: string;
  businessId: string;
  projectId: string;
  key?: Buffer | null;
}): EncryptedProjectSecret | { error: "ENCRYPTION_NOT_CONFIGURED" | "EMPTY_PASSWORD" } {
  const password = input.plaintext;
  if (!password) return { error: "EMPTY_PASSWORD" };
  const key = input.key ?? parseProjectCredentialsKey();
  if (!key) return { error: "ENCRYPTION_NOT_CONFIGURED" };

  const iv = randomBytes(12);
  const cipher = createCipheriv(PROJECT_CREDENTIALS_ALGO, key, iv);
  const aad = projectCredentialAad(input.businessId, input.projectId);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion: PROJECT_CREDENTIALS_KEY_VERSION,
    algorithm: PROJECT_CREDENTIALS_ALGO,
  };
}

export function decryptProjectPassword(input: {
  record: EncryptedProjectSecret;
  businessId: string;
  projectId: string;
  key?: Buffer | null;
}): { ok: true; password: string } | { ok: false; error: "ENCRYPTION_NOT_CONFIGURED" | "DECRYPT_FAILED" | "AAD_MISMATCH" } {
  const key = input.key ?? parseProjectCredentialsKey();
  if (!key) return { ok: false, error: "ENCRYPTION_NOT_CONFIGURED" };
  try {
    const iv = Buffer.from(input.record.iv, "base64");
    const authTag = Buffer.from(input.record.authTag, "base64");
    const ciphertext = Buffer.from(input.record.ciphertext, "base64");
    const decipher = createDecipheriv(PROJECT_CREDENTIALS_ALGO, key, iv);
    const aad = projectCredentialAad(input.businessId, input.projectId);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return { ok: true, password: plain };
  } catch {
    return { ok: false, error: "DECRYPT_FAILED" };
  }
}

/** Constant-time-ish empty check helper for tests. */
export function secretsEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
