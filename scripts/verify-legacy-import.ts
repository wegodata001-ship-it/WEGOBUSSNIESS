import { loadProjectEnv } from "./load-env";
import { LEGACY_PROJECTS, LEGACY_SETTINGS } from "./legacy-data/source";

loadProjectEnv();

async function main() {
  const { getAdminDb, isFirebaseAdminConfigured } = await import("../src/lib/firebase/admin");
  if (!isFirebaseAdminConfigured()) process.exit(1);
  const db = getAdminDb();
  const businesses = await db.collection("businesses").where("slug", "==", "wego").limit(1).get();
  const business = businesses.docs[0];
  if (!business) process.exit(1);

  const [projects, tasks, settings] = await Promise.all([
    business.ref.collection("projects").get(),
    business.ref.collection("tasks").get(),
    business.ref.collection("settings").get(),
  ]);

  const missingProjects = LEGACY_PROJECTS.filter((row) => !projects.docs.some((docSnap) => docSnap.id === row.Project_ID));
  const missingSettings = LEGACY_SETTINGS.filter((row) => !settings.docs.some((docSnap) => docSnap.id === row.Set_ID || (docSnap.data().type === row.Type && docSnap.data().value === row.Value)));
  const seedProjects = projects.docs.filter((docSnap) => String(docSnap.data().seedKey ?? "").startsWith("wego-project-"));
  const seedTasks = tasks.docs.filter((docSnap) => String(docSnap.data().seedKey ?? "").startsWith("wego-task-"));

  console.log("VERIFY_PROJECTS_TOTAL", projects.size);
  console.log("VERIFY_LEGACY_PROJECTS", LEGACY_PROJECTS.length - missingProjects.length);
  console.log("VERIFY_MISSING_PROJECTS", missingProjects.map((row) => row.Project_ID).join(",") || "0");
  console.log("VERIFY_SETTINGS", settings.docs.filter((docSnap) => docSnap.id !== "general").length);
  console.log("VERIFY_MISSING_SETTINGS", missingSettings.map((row) => row.Set_ID).join(",") || "0");
  console.log("VERIFY_EXISTING_SEED_PROJECTS", seedProjects.length);
  console.log("VERIFY_EXISTING_TASKS", tasks.size);
  console.log("VERIFY_SEED_TASKS_KEPT", seedTasks.length);
  console.log("VERIFY_SAMPLE_NAME", projects.docs.find((docSnap) => docSnap.id === "PRJ-1789454997938")?.data().name);
  console.log("VERIFY_SAMPLE_AR", projects.docs.find((docSnap) => docSnap.id === "PRJ-1789558934596")?.data().name);
  console.log("VERIFY_TYPO_KEPT", projects.docs.find((docSnap) => docSnap.id === "PRJ-1789456852263")?.data().name);
  console.log("VERIFY_PROJECT_BUSINESS", projects.docs.every((docSnap) => docSnap.data().businessId === business.id) ? "PASS" : "FAIL");
}

main().catch((error) => {
  console.error("VERIFY_FAILED", error instanceof Error ? error.message : "error");
  process.exit(1);
});
