import { loadProjectEnv } from "./load-env";
import { normalizeProjectProgress } from "../src/lib/admin/project-progress";
import { toProject } from "../src/lib/firebase/converters";

loadProjectEnv();

async function main() {
  const { getAdminDb, isFirebaseAdminConfigured } = await import("../src/lib/firebase/admin");
  if (!isFirebaseAdminConfigured()) process.exit(1);
  const db = getAdminDb();
  const businesses = await db.collection("businesses").where("slug", "==", "wego").limit(1).get();
  const business = businesses.docs[0];
  if (!business) process.exit(1);
  const ref = business.ref.collection("projects").doc("PRJ-1789460811313");
  const before = await ref.get();
  if (!before.exists) {
    console.log("PROJECT_MISSING");
    process.exit(1);
  }
  const original = before.data();
  const originalProgress = original?.progress;
  await ref.set({ progress: normalizeProjectProgress(35), updatedAt: new Date() }, { merge: true });
  const mid = toProject(ref.id, (await ref.get()).data()!);
  await ref.set({ progress: normalizeProjectProgress(100), updatedAt: new Date() }, { merge: true });
  const last = toProject(ref.id, (await ref.get()).data()!);
  if (originalProgress === undefined) {
    await ref.set({ progress: 0, updatedAt: new Date() }, { merge: true });
  } else {
    await ref.set({ progress: originalProgress, updatedAt: new Date() }, { merge: true });
  }
  const restored = toProject(ref.id, (await ref.get()).data()!);
  console.log("WRITE_35", mid.progress === 35 ? "PASS" : `FAIL ${mid.progress}`);
  console.log("WRITE_100", last.progress === 100 ? "PASS" : `FAIL ${last.progress}`);
  console.log("RESTORE", restored.progress === normalizeProjectProgress(originalProgress) ? "PASS" : `FAIL ${restored.progress}`);
  console.log("MISSING_FALLBACK", normalizeProjectProgress(undefined) === 0 ? "PASS" : "FAIL");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "error");
  process.exit(1);
});
