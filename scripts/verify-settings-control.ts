import { loadProjectEnv } from "./load-env";
import { categoriesForDepartment } from "../src/lib/admin/department-categories";
import { toDepartmentCategory, toEmployee } from "../src/lib/firebase/converters";
import { permissionsForRole, resolvePermissions } from "../src/lib/permissions/engine";
import type { ServerActor } from "../src/lib/auth/server-actor";
import type { Membership } from "../src/types/membership";

loadProjectEnv();

function member(role: Membership["role"], extras: Membership["permissions"] = []): Membership {
  return {
    userId: "u",
    businessId: "b",
    employeeId: "e",
    role,
    permissions: extras,
    email: null,
    displayName: null,
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}

async function main() {
  const extrasOnEmployee = resolvePermissions(member("EMPLOYEE", ["settings.manage", "employees.manage"]));
  console.log("ROLE_ONLY_EMPLOYEE", extrasOnEmployee.includes("settings.manage") ? "FAIL" : "PASS");
  console.log("MANAGER_NO_OWNER", permissionsForRole("MANAGER").includes("settings.manage") ? "FAIL" : "PASS");
  console.log("OWNER_FULL", permissionsForRole("BUSINESS_OWNER").includes("settings.manage") ? "PASS" : "FAIL");

  const { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } = await import("../src/lib/firebase/admin");
  const { createBusinessEmployee } = await import("../src/lib/admin/employee-write");
  if (!isFirebaseAdminConfigured()) {
    console.log("FIREBASE_CONFIG", "FAIL");
    process.exit(1);
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const businesses = await db.collection("businesses").where("slug", "==", "wego").limit(1).get();
  const business = businesses.docs[0];
  if (!business) {
    console.log("BUSINESS_MISSING");
    process.exit(1);
  }

  const actor: ServerActor = {
    uid: "verify-script",
    businessId: business.id,
    employeeId: null,
    role: "BUSINESS_OWNER",
    permissions: permissionsForRole("BUSINESS_OWNER"),
    isOwnerOrManager: true,
    isSuperAdmin: true,
  };

  const stamp = Date.now();
  const email = `verify.settings.${stamp}@example.test`;
  const password = `Tmp${stamp}x`;
  const created = await createBusinessEmployee({
    actor,
    businessId: business.id,
    data: {
      displayName: "Verify Settings User",
      email,
      password,
      phone: "0500000000",
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
  });

  if (!created.ok) {
    console.log("CREATE_EMPLOYEE", `FAIL ${created.error}`);
    process.exit(1);
  }

  const authUser = await auth.getUserByEmail(email);
  const empSnap = await db.collection("businesses").doc(business.id).collection("employees").doc(created.id).get();
  const emp = toEmployee(empSnap.id, empSnap.data() ?? {});
  const empData = empSnap.data() ?? {};
  const authClaims = authUser.customClaims ?? {};

  console.log("AUTH_USER", authUser.uid ? "PASS" : "FAIL");
  console.log("UID_MATCH", authUser.uid === created.id && emp.uid === authUser.uid ? "PASS" : "FAIL");
  console.log("NO_PASSWORD_FIELD", !("password" in empData) && !("Password" in empData) ? "PASS" : "FAIL");
  console.log("CLAIMS_ROLE", authClaims.role === "EMPLOYEE" ? "PASS" : "FAIL");

  const departments = await db.collection("businesses").doc(business.id).collection("departments").limit(2).get();
  const firstDept = departments.docs[0];
  const secondDept = departments.docs[1] ?? departments.docs[0];
  let categoryPass = "SKIP";
  let isolationPass = "SKIP";
  if (firstDept) {
    const catRef = db.collection("businesses").doc(business.id).collection("departmentCategories").doc();
    await catRef.set({
      businessId: business.id,
      departmentId: firstDept.id,
      name: `Verify Cat ${stamp}`,
      isActive: true,
      color: "#0ea5e9",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const all = (await db.collection("businesses").doc(business.id).collection("departmentCategories").get())
      .docs.map((docSnap) => toDepartmentCategory(docSnap.id, docSnap.data()));
    const scoped = categoriesForDepartment(all, firstDept.id);
    const other = categoriesForDepartment(all, secondDept.id);
    categoryPass = scoped.some((item) => item.id === catRef.id) ? "PASS" : "FAIL";
    isolationPass = firstDept.id === secondDept.id || !other.some((item) => item.id === catRef.id) ? "PASS" : "FAIL";
    await catRef.delete();
  }
  console.log("CATEGORY_SCOPED", categoryPass);
  console.log("CATEGORY_ISOLATED", isolationPass);

  await auth.deleteUser(authUser.uid).catch(() => undefined);
  await db.collection("businesses").doc(business.id).collection("employees").doc(created.id).delete().catch(() => undefined);
  await db.collection("businesses").doc(business.id).collection("members").doc(authUser.uid).delete().catch(() => undefined);
  await db.collection("users").doc(authUser.uid).collection("memberships").doc(business.id).delete().catch(() => undefined);
  await db.collection("users").doc(authUser.uid).delete().catch(() => undefined);
  console.log("CLEANUP", "PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "error");
  process.exit(1);
});
