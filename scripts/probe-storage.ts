import { randomBytes } from "node:crypto";
import { getAdminApp, isFirebaseAdminConfigured } from "../src/lib/firebase/admin";
import { getAdminBucket, getAdminBucketName } from "../src/lib/firebase/admin-storage";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

async function main() {
  const bucketName = getAdminBucketName();
  console.log("ADMIN_CONFIGURED", isFirebaseAdminConfigured() ? "YES" : "NO");
  console.log("BUCKET_NAME", bucketName || "MISSING");
  getAdminApp();
  if (!bucketName) {
    console.log("PROBE_FAIL STORAGE_BUCKET_MISSING");
    process.exit(1);
  }
  const bucket = getAdminBucket();
  const [exists] = await bucket.exists();
  console.log("BUCKET_EXISTS", exists ? "YES" : "NO");
  if (!exists) {
    console.log("PROBE_FAIL NO_SUCH_BUCKET");
    process.exit(1);
  }
  const path = `probes/storage-${Date.now()}-${randomBytes(4).toString("hex")}.txt`;
  await bucket.file(path).save(Buffer.from("wego-storage-probe"), {
    contentType: "text/plain",
    resumable: false,
  });
  console.log("UPLOAD", "OK");
  const [signed] = await bucket.file(path).getSignedUrl({
    action: "read",
    expires: Date.now() + 60_000,
  });
  console.log("SIGNED_URL", signed.startsWith("https://") ? "OK" : "FAIL");
  await bucket.file(path).delete({ ignoreNotFound: true });
  console.log("CLEANUP", "OK");
  console.log("PROBE_PASS");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "FAILED";
  console.error("PROBE_FAIL", message.replace(/-----BEGIN[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED]").slice(0, 300));
  process.exit(1);
});
