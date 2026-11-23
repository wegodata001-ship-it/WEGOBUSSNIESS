import { isDateOnly } from "@/lib/dates/format";
import {
  emptyProjectSystemDetails,
  PROJECT_DB_KINDS,
  PROJECT_HOSTING_KINDS,
  type ProjectDbKind,
  type ProjectHostingKind,
  type ProjectSystemDetails,
} from "@/types/project-system";

export const PROJECT_SYSTEM_FILE_MAX_BYTES = 25 * 1024 * 1024;

export const PROJECT_SYSTEM_ALLOWED_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "gif", "webp", "svg",
  "txt", "csv", "zip", "json", "md",
]);

/** Extensions / names that must never be uploaded (secrets). */
export const PROJECT_SYSTEM_BLOCKED_EXT = new Set([
  "env", "pem", "p12", "pfx", "key", "crt", "cer",
]);

export const PROJECT_SYSTEM_BLOCKED_NAME_PARTS = [
  ".env",
  "service-account",
  "serviceaccount",
  "credentials",
  "secret",
  "private-key",
  "privatekey",
  "id_rsa",
  "firebase-adminsdk",
];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: unknown) {
  const next = text(value);
  return next || null;
}

export function parseOptionalHttpsUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isBlockedSecretFileName(name: string) {
  const lower = name.trim().toLowerCase();
  const ext = fileExtension(lower);
  if (PROJECT_SYSTEM_BLOCKED_EXT.has(ext)) return true;
  if (lower.startsWith(".env") || lower === "env") return true;
  return PROJECT_SYSTEM_BLOCKED_NAME_PARTS.some((part) => lower.includes(part));
}

export function isAllowedProjectSystemFile(file: { name: string; type: string; size: number }) {
  if (file.size <= 0 || file.size > PROJECT_SYSTEM_FILE_MAX_BYTES) {
    return { ok: false as const, error: "FILE_TOO_LARGE" };
  }
  if (isBlockedSecretFileName(file.name)) {
    return { ok: false as const, error: "SECRET_FILE_DENIED" };
  }
  const ext = fileExtension(file.name);
  if (!PROJECT_SYSTEM_ALLOWED_EXT.has(ext)) {
    return { ok: false as const, error: "FILE_TYPE" };
  }
  return { ok: true as const };
}

/**
 * Password plaintext is never accepted for storage.
 * passwordConfigured / passwordSecretRef are server-managed only (credentials vault).
 */
export function sanitizeProjectSystemDetails(
  input: Record<string, unknown>,
  current?: ProjectSystemDetails | null,
): { ok: true; data: Omit<ProjectSystemDetails, "updatedAt" | "updatedByUserId"> }
  | { ok: false; error: "PASSWORD_PLAINTEXT_FORBIDDEN" | "INVALID_URL" | "INVALID_DATE" } {
  if (input.password !== undefined && text(input.password)) {
    return { ok: false, error: "PASSWORD_PLAINTEXT_FORBIDDEN" };
  }
  if (input.passwordPlain !== undefined || input.plainPassword !== undefined) {
    return { ok: false, error: "PASSWORD_PLAINTEXT_FORBIDDEN" };
  }

  const base = current ?? emptyProjectSystemDetails();
  const systemUrl = input.systemUrl !== undefined ? parseOptionalHttpsUrl(input.systemUrl) : base.systemUrl;
  const adminUrl = input.adminUrl !== undefined ? parseOptionalHttpsUrl(input.adminUrl) : base.adminUrl;
  const githubUrl = input.githubUrl !== undefined ? parseOptionalHttpsUrl(input.githubUrl) : base.githubUrl;
  if (input.systemUrl !== undefined && text(input.systemUrl) && !systemUrl) return { ok: false, error: "INVALID_URL" };
  if (input.adminUrl !== undefined && text(input.adminUrl) && !adminUrl) return { ok: false, error: "INVALID_URL" };
  if (input.githubUrl !== undefined && text(input.githubUrl) && !githubUrl) return { ok: false, error: "INVALID_URL" };

  const renewal = input.domainRenewalDate !== undefined
    ? nullable(input.domainRenewalDate)
    : base.domainRenewalDate;
  if (renewal && !isDateOnly(renewal)) return { ok: false, error: "INVALID_DATE" };

  const databaseKind = input.databaseKind !== undefined
    ? (PROJECT_DB_KINDS.includes(input.databaseKind as ProjectDbKind) ? input.databaseKind as ProjectDbKind : null)
    : base.databaseKind;
  const hostingKind = input.hostingKind !== undefined
    ? (PROJECT_HOSTING_KINDS.includes(input.hostingKind as ProjectHostingKind) ? input.hostingKind as ProjectHostingKind : null)
    : base.hostingKind;

  // Never accept client-supplied vault refs; preserve server-managed flags only.
  const passwordSecretRef = base.passwordSecretRef;
  const passwordConfigured = Boolean(base.passwordConfigured || passwordSecretRef);

  return {
    ok: true,
    data: {
      systemName: input.systemName !== undefined ? text(input.systemName) : base.systemName,
      systemDescription: input.systemDescription !== undefined ? text(input.systemDescription) : base.systemDescription,
      systemUrl,
      adminUrl,
      username: input.username !== undefined ? text(input.username) : base.username,
      passwordConfigured,
      passwordSecretRef,
      githubUrl,
      databaseKind,
      databaseNotes: input.databaseNotes !== undefined ? text(input.databaseNotes) : base.databaseNotes,
      hostingKind,
      hostingNotes: input.hostingNotes !== undefined ? text(input.hostingNotes) : base.hostingNotes,
      domain: input.domain !== undefined ? text(input.domain) : base.domain,
      domainRenewalDate: renewal,
      ownerEmployeeId: input.ownerEmployeeId !== undefined ? nullable(input.ownerEmployeeId) : base.ownerEmployeeId,
      technicalNotes: input.technicalNotes !== undefined ? text(input.technicalNotes) : base.technicalNotes,
    },
  };
}

export function toProjectSystemDetails(data: unknown): ProjectSystemDetails {
  if (!data || typeof data !== "object") return emptyProjectSystemDetails();
  const raw = data as Record<string, unknown>;
  const sanitized = sanitizeProjectSystemDetails(raw);
  if (!sanitized.ok) return emptyProjectSystemDetails();
  let updatedAt: Date | null = null;
  if (raw.updatedAt instanceof Date) updatedAt = raw.updatedAt;
  else if (typeof raw.updatedAt === "string" && raw.updatedAt) {
    const parsed = new Date(raw.updatedAt);
    updatedAt = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (raw.updatedAt && typeof raw.updatedAt === "object" && "toDate" in (raw.updatedAt as object)) {
    updatedAt = (raw.updatedAt as { toDate: () => Date }).toDate();
  }
  return {
    ...sanitized.data,
    updatedAt,
    updatedByUserId: typeof raw.updatedByUserId === "string" ? raw.updatedByUserId : null,
  };
}
