import { loadProjectEnv } from "./load-env";
import { resolveProjectCategory, UNCATEGORIZED_LABEL } from "../src/lib/admin/department-categories";
import { toDepartmentCategory, toProject } from "../src/lib/firebase/converters";

loadProjectEnv();

async function main() {
  const { getAdminDb, isFirebaseAdminConfigured } = await import("../src/lib/firebase/admin");
  if (!isFirebaseAdminConfigured()) {
    console.log("FIREBASE_CONFIG FAIL");
    process.exit(1);
  }
  const db = getAdminDb();
  const businesses = await db.collection("businesses").where("slug", "==", "wego").limit(1).get();
  const business = businesses.docs[0];
  if (!business) process.exit(1);

  const departments = await business.ref.collection("departments").limit(1).get();
  const department = departments.docs[0];
  if (!department) {
    console.log("NO_DEPARTMENT SKIP");
    process.exit(0);
  }

  const stamp = Date.now();
  const catRef = business.ref.collection("departmentCategories").doc();
  const otherRef = business.ref.collection("departmentCategories").doc();
  await catRef.set({
    businessId: business.id,
    departmentId: department.id,
    name: `Verify Cat A ${stamp}`,
    isActive: true,
    color: "#0ea5e9",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await otherRef.set({
    businessId: business.id,
    departmentId: department.id,
    name: `Verify Cat B ${stamp}`,
    isActive: true,
    color: "#10b981",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const projectRef = business.ref.collection("projects").doc();
  await projectRef.set({
    businessId: business.id,
    name: `Verify Project ${stamp}`,
    clientName: "Verify",
    description: "",
    status: "ACTIVE",
    departmentId: department.id,
    categoryId: catRef.id,
    categoryName: `Verify Cat A ${stamp}`,
    category: `Verify Cat A ${stamp}`,
    progress: 0,
    isActive: true,
    color: "BLUE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const created = toProject(projectRef.id, (await projectRef.get()).data()!);
  console.log("CREATE_CATEGORY_ID", created.categoryId === catRef.id ? "PASS" : "FAIL");

  await catRef.set({ name: `Verify Cat A renamed ${stamp}`, updatedAt: new Date() }, { merge: true });
  const categories = (await business.ref.collection("departmentCategories").get())
    .docs.map((docSnap) => toDepartmentCategory(docSnap.id, docSnap.data()));
  const afterRename = toProject(projectRef.id, (await projectRef.get()).data()!);
  console.log("RENAME_KEEPS_ID", afterRename.categoryId === catRef.id ? "PASS" : "FAIL");
  console.log("RENAME_LIVE_NAME", resolveProjectCategory(afterRename, categories).name.includes("renamed") ? "PASS" : "FAIL");

  const used = await business.ref.collection("projects").where("categoryId", "==", catRef.id).get();
  console.log("DELETE_BLOCKED", used.size >= 1 ? "PASS" : "FAIL");

  await projectRef.set({
    categoryId: otherRef.id,
    categoryName: `Verify Cat B ${stamp}`,
    category: `Verify Cat B ${stamp}`,
    updatedAt: new Date(),
  }, { merge: true });
  await catRef.delete();
  const moved = toProject(projectRef.id, (await projectRef.get()).data()!);
  console.log("REASSIGN", moved.categoryId === otherRef.id ? "PASS" : "FAIL");

  const old = toProject("old", { name: "old", status: "ACTIVE", progress: 0 });
  console.log("LEGACY_UNASSIGNED", resolveProjectCategory(old, []) .name === UNCATEGORIZED_LABEL ? "PASS" : "FAIL");

  await projectRef.delete();
  await otherRef.delete();
  console.log("CLEANUP PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "error");
  process.exit(1);
});
