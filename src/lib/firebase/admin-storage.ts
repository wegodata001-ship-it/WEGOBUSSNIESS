import { getAdminStorage } from "@/lib/firebase/admin";

function configuredBucketName() {
  const fromPublic = (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").trim();
  const fromAdmin = (process.env.FIREBASE_STORAGE_BUCKET ?? "").trim();
  const projectId = (
    process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    || ""
  ).trim();
  if (fromPublic) return fromPublic;
  if (fromAdmin) return fromAdmin;
  if (projectId) return `${projectId}.firebasestorage.app`;
  return "";
}

export function getAdminBucketName() {
  return configuredBucketName();
}

export function getAdminBucket() {
  const name = configuredBucketName();
  if (!name) {
    throw new Error("STORAGE_BUCKET_MISSING");
  }
  return getAdminStorage().bucket(name);
}

export function classifyStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const text = `${code} ${message}`.toLowerCase();
  if (text.includes("storage_bucket_missing") || text.includes("bucket name not specified")) {
    return "STORAGE_NOT_CONFIGURED" as const;
  }
  if (text.includes("could not load the default credentials") || text.includes("could not refresh access token")) {
    return "STORAGE_NOT_CONFIGURED" as const;
  }
  if (text.includes("permission") || text.includes("forbidden") || text.includes("403") || text.includes("access denied")) {
    return "STORAGE_FORBIDDEN" as const;
  }
  if (text.includes("not found") || text.includes("404") || text.includes("no such bucket") || text.includes("does not exist")) {
    return "STORAGE_NOT_FOUND" as const;
  }
  if (text.includes("invalid_grant") || text.includes("invalid jwt") || text.includes("invalid_client")) {
    return "STORAGE_NOT_CONFIGURED" as const;
  }
  return "STORAGE_FAILED" as const;
}

export function safeStorageLog(stage: string, extra?: Record<string, string | number | boolean | null | undefined>) {
  const requestId = extra && typeof extra.requestId === "string" ? extra.requestId : "";
  const payload = extra ? { ...extra, requestId: undefined } : {};
  if (stage.endsWith("_ok") || stage.endsWith("_ready")) {
    console.info("[TASK_STORAGE]", requestId || "-", stage, payload);
    return;
  }
  console.error("[TASK_STORAGE]", requestId || "-", stage, payload);
}
