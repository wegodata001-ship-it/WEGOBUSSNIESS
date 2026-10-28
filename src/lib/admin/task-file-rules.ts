export const TASK_FILE_MAX_BYTES = 25 * 1024 * 1024;

export const TASK_FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv,.zip,.json";

export const TASK_ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/json",
]);

export const TASK_ALLOWED_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "gif", "webp", "svg",
  "txt", "csv", "zip", "json",
]);

export function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isAllowedTaskFile(file: { name: string; type: string; size: number }) {
  if (file.size <= 0 || file.size > TASK_FILE_MAX_BYTES) return { ok: false as const, error: "FILE_TOO_LARGE" };
  const ext = fileExtension(file.name);
  if (TASK_ALLOWED_TYPES.has(file.type) || TASK_ALLOWED_EXT.has(ext)) return { ok: true as const };
  return { ok: false as const, error: "FILE_TYPE" };
}

export function parseHttpsUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeFileName(name: string) {
  return name.replace(/[^\w.\u0590-\u05ff\u0600-\u06ff-]+/g, "-").slice(0, 80) || "file";
}

export type TaskFileMessageKey =
  | "work.uploadPermissionDenied"
  | "work.fileTooLarge"
  | "work.fileTypeDenied"
  | "work.uploadNetworkFailed"
  | "work.uploadStorageFailed"
  | "work.uploadFailed"
  | "work.deleteFailed";

export function taskFileErrorKey(error?: string): TaskFileMessageKey {
  switch (error) {
    case "FORBIDDEN":
    case "AUTH_REQUIRED":
    case "STORAGE_FORBIDDEN":
      return "work.uploadPermissionDenied";
    case "FILE_TOO_LARGE":
      return "work.fileTooLarge";
    case "FILE_TYPE":
      return "work.fileTypeDenied";
    case "NETWORK":
      return "work.uploadNetworkFailed";
    case "STORAGE_FAILED":
    case "STORAGE_NOT_CONFIGURED":
    case "STORAGE_NOT_FOUND":
      return "work.uploadStorageFailed";
    default:
      return "work.uploadFailed";
  }
}
