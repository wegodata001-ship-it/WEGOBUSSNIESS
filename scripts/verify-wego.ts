import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "../src/lib/firebase/admin";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

async function main() {
  if (!isFirebaseAdminConfigured()) {
    console.error("WAITING_FOR_FIREBASE_CONFIG");
    process.exit(1);
  }

  const db = getAdminDb();
  const businesses = await db.collection("businesses").where("slug", "==", "wego").get();
  const business = businesses.docs[0];
  if (!business) {
    console.log("VERIFY_FAIL no-wego");
    process.exit(1);
  }

  const businessId = business.id;
  const members = await business.ref.collection("members").get();
  const employees = await business.ref.collection("employees").get();
  const departments = await business.ref.collection("departments").get();
  const tasks = await business.ref.collection("tasks").get();
  const seededTasks = tasks.docs.filter((docSnap) => String(docSnap.data().seedKey ?? "").startsWith("wego-task-"));

  const emails = ["wego.biz24@gmail.com", "abulieltasneem23@gmail.com", "ressan@gmail.com"];
  const auth = getAdminAuth();
  const authResults = await Promise.all(emails.map((email) => auth.getUserByEmail(email).then(() => true).catch(() => false)));

  const deptNames = departments.docs.map((docSnap) => String(docSnap.data().name));
  const employeeEmails = employees.docs.map((docSnap) => String(docSnap.data().email));
  const tasneem = employees.docs.find((docSnap) => docSnap.data().email === "abulieltasneem23@gmail.com");
  const ressan = employees.docs.find((docSnap) => docSnap.data().email === "ressan@gmail.com");
  const owner = employees.docs.find((docSnap) => docSnap.data().email === "wego.biz24@gmail.com");
  const systems = departments.docs.find((docSnap) => docSnap.data().slug === "systems");
  const photo = departments.docs.find((docSnap) => docSnap.data().slug === "photography");
  const management = departments.docs.find((docSnap) => docSnap.data().slug === "management");

  console.log("BUSINESS_ID", businessId);
  console.log("BUSINESS_COUNT", businesses.size);
  console.log("MEMBERS", members.size);
  console.log("EMPLOYEES", employees.size);
  console.log("DEPARTMENTS", departments.size);
  console.log("SEEDED_TASKS", seededTasks.length);
  console.log("DEPT_ACCOUNTS", deptNames.includes("חשבונות") ? "PASS" : "FAIL");
  console.log("DEPT_PHOTO", deptNames.includes("צילום") ? "PASS" : "FAIL");
  console.log("DEPT_SYSTEMS", deptNames.includes("מערכות") ? "PASS" : "FAIL");
  console.log("DEPT_MGMT", deptNames.includes("ניהול") ? "PASS" : "FAIL");
  console.log("TASNEEM_DEPT_MATCH", tasneem?.data().departmentId === systems?.id ? "PASS" : "FAIL");
  console.log("RESSAN_DEPT_MATCH", ressan?.data().departmentId === photo?.id ? "PASS" : "FAIL");
  console.log("OWNER_DEPT_MATCH", owner?.data().departmentId === management?.id ? "PASS" : "FAIL");
  console.log("OWNER_AUTH", authResults[0] ? "PASS" : "FAIL");
  console.log("TASNEEM_AUTH", authResults[1] ? "PASS" : "FAIL");
  console.log("RESSAN_AUTH", authResults[2] ? "PASS" : "FAIL");
  console.log("EMPLOYEE_EMAILS", employeeEmails.length);
  console.log("OWNER_MEMBER_ROLE", members.docs.find((docSnap) => docSnap.data().email === "wego.biz24@gmail.com")?.data().role ?? "MISSING");
}

main().catch((error) => {
  console.error("VERIFY_FAILED", error instanceof Error ? error.message : "error");
  process.exit(1);
});
