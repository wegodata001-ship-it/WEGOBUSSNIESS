import { loadProjectEnv } from "./load-env";

loadProjectEnv();

function fieldNames(data: FirebaseFirestore.DocumentData) {
  return Object.keys(data).sort().join(", ");
}

async function main() {
  const { getAdminDb, isFirebaseAdminConfigured } = await import("../src/lib/firebase/admin");
  if (!isFirebaseAdminConfigured()) {
    console.error("WAITING_FOR_FIREBASE_CONFIG");
    process.exit(1);
  }

  const db = getAdminDb();
  const root = await db.listCollections();
  console.log("DATABASE: Firestore");
  console.log("ROOT_COLLECTIONS:", root.map((item) => item.id).join(", ") || "(none)");

  const businesses = await db.collection("businesses").get();
  console.log("BUSINESSES:", businesses.size);
  for (const docSnap of businesses.docs) {
    const data = docSnap.data();
    console.log(`BUSINESS ${docSnap.id} name=${data.name ?? ""} slug=${data.slug ?? ""}`);
    const sub = await docSnap.ref.listCollections();
    console.log(`  SUBCOLLECTIONS: ${sub.map((item) => item.id).join(", ")}`);
  }

  const wego = businesses.docs.find((docSnap) => docSnap.data().slug === "wego") ?? businesses.docs[0];
  if (!wego) {
    console.log("NO_BUSINESS");
    process.exit(1);
  }

  const businessId = wego.id;
  console.log("BUSINESS ID:", businessId);
  console.log("PROJECT MODEL: businesses/{id}/projects  fields from sample or type Project + optional legacy");
  console.log("TASK MODEL: businesses/{id}/tasks");
  console.log("COMMENT MODEL: businesses/{id}/tasks/{taskId}/comments");
  console.log("SETTING MODEL: businesses/{id}/settings");

  const [projects, tasks, settings, employees, members, users] = await Promise.all([
    wego.ref.collection("projects").get(),
    wego.ref.collection("tasks").get(),
    wego.ref.collection("settings").get(),
    wego.ref.collection("employees").get(),
    wego.ref.collection("members").get(),
    db.collection("users").get(),
  ]);

  let comments = 0;
  const taskFields = new Set<string>();
  for (const task of tasks.docs) {
    Object.keys(task.data()).forEach((key) => taskFields.add(key));
    const snap = await task.ref.collection("comments").get();
    comments += snap.size;
  }

  const projectFields = new Set<string>();
  projects.docs.forEach((docSnap) => Object.keys(docSnap.data()).forEach((key) => projectFields.add(key)));

  console.log("EXISTING PROJECTS:", projects.size);
  console.log("EXISTING TASKS:", tasks.size);
  console.log("EXISTING COMMENTS:", comments);
  console.log("EXISTING SETTINGS:", settings.size);
  console.log("PROJECT FIELDS:", [...projectFields].sort().join(", ") || "(empty)");
  console.log("TASK FIELDS:", [...taskFields].sort().join(", ") || "(empty)");
  console.log("SETTING DOCS:", settings.docs.map((docSnap) => docSnap.id).join(", ") || "(none)");
  if (projects.docs[0]) console.log("PROJECT SAMPLE KEYS:", fieldNames(projects.docs[0].data()));
  if (tasks.docs[0]) console.log("TASK SAMPLE KEYS:", fieldNames(tasks.docs[0].data()));

  const existingLegacyProjects = projects.docs.filter((docSnap) =>
    docSnap.id.startsWith("PRJ-") || String(docSnap.data().legacyId ?? docSnap.data().seedKey ?? "").startsWith("PRJ-"),
  );
  const existingLegacyTasks = tasks.docs.filter((docSnap) =>
    docSnap.id.startsWith("TSK-") || String(docSnap.data().legacyId ?? docSnap.data().seedKey ?? "").startsWith("TSK-"),
  );
  console.log("EXISTING LEGACY PROJECTS:", existingLegacyProjects.length);
  console.log("EXISTING LEGACY TASKS:", existingLegacyTasks.length);

  console.log("USERS:", users.size);
  for (const docSnap of users.docs) {
    const data = docSnap.data();
    console.log(`USER ${docSnap.id} email=${data.email ?? ""} name=${data.displayName ?? ""}`);
  }
  console.log("EMPLOYEES:", employees.size);
  for (const docSnap of employees.docs) {
    const data = docSnap.data();
    console.log(`EMPLOYEE ${docSnap.id} email=${data.email ?? ""} name=${data.displayName ?? ""} userId=${data.userId ?? ""}`);
  }
  console.log("MEMBERS:", members.size);
  for (const docSnap of members.docs) {
    const data = docSnap.data();
    console.log(`MEMBER ${docSnap.id} email=${data.email ?? ""} role=${data.role ?? ""}`);
  }

  const looksLegacy = ["Projects", "Tasks", "Comments", "Settings", "projects", "tasks"];
  for (const name of looksLegacy) {
    const snap = await db.collection(name).limit(3).get();
    if (!snap.empty) {
      console.log(`ROOT ${name} count_sample=${snap.size} keys=${fieldNames(snap.docs[0]!.data())} id=${snap.docs[0]!.id}`);
    }
  }
}

main().catch((error) => {
  console.error("AUDIT_FAILED", error instanceof Error ? error.message : "error");
  process.exit(1);
});
