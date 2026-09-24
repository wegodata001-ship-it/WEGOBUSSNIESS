import { loadProjectEnv } from "./load-env";
import { buildCategoryMap } from "../src/lib/admin/category-color";

loadProjectEnv();

async function main() {
  const { getAdminDb, isFirebaseAdminConfigured } = await import("../src/lib/firebase/admin");
  if (!isFirebaseAdminConfigured()) process.exit(1);
  const db = getAdminDb();
  const businesses = await db.collection("businesses").where("slug", "==", "wego").limit(1).get();
  const business = businesses.docs[0];
  if (!business) process.exit(1);
  const [projects, settings] = await Promise.all([
    business.ref.collection("projects").get(),
    business.ref.collection("settings").get(),
  ]);
  const catalog = settings.docs
    .filter((docSnap) => docSnap.data().type === "PROJ_CATEGORY")
    .map((docSnap) => ({
      id: docSnap.id,
      businessId: business.id,
      legacyId: String(docSnap.data().legacyId ?? docSnap.id),
      type: "PROJ_CATEGORY" as const,
      value: String(docSnap.data().value ?? ""),
      color: String(docSnap.data().color ?? ""),
      createdAt: null,
      updatedAt: null,
    }));
  const map = buildCategoryMap(catalog, projects.docs.map((docSnap) => String(docSnap.data().category ?? "")));
  console.log("CATALOG_CATEGORIES", catalog.length);
  for (const item of catalog) console.log("SETTING", item.value, item.color);
  console.log("PROJECTS", projects.size);
  for (const docSnap of projects.docs) {
    const name = String(docSnap.data().name ?? "");
    const category = String(docSnap.data().category ?? "");
    const color = map.get(category)?.color ?? "FALLBACK";
    console.log("PROJECT", docSnap.id, name, category || "(none)", color);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "error");
  process.exit(1);
});
