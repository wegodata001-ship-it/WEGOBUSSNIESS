/**
 * READ-ONLY inventory / wipe dry-run for WEGO Business.
 *
 * Safety:
 * - Requires DRY_RUN=true (or MODE=inventory).
 * - Never deletes Auth users, Firestore docs, or Storage objects.
 * - Refuses EXECUTE / APPLY / DELETE modes.
 * - Masks emails and truncates UIDs in console output.
 *
 * Usage (after local .env with Admin credentials is provided by an operator):
 *   DRY_RUN=true npx tsx scripts/inventory-reset-dry-run.ts
 *   DRY_RUN=true BUSINESS_SLUG=wego npx tsx scripts/inventory-reset-dry-run.ts
 */
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "../src/lib/firebase/admin";
import { getAdminBucket, getAdminBucketName } from "../src/lib/firebase/admin-storage";
import { businessCollections, collections } from "../src/lib/firebase/paths";
import { loadProjectEnv } from "./load-env";

loadProjectEnv();

const DRY_RUN = (process.env.DRY_RUN ?? "").trim().toLowerCase() === "true"
  || (process.env.MODE ?? "").trim().toLowerCase() === "inventory";
const FORBIDDEN_MODE = ["EXECUTE", "APPLY", "DELETE", "WIPE", "RESET"]
  .includes((process.env.MODE ?? "").trim().toUpperCase())
  || (process.env.EXECUTE ?? "").trim().toLowerCase() === "true"
  || (process.env.ALLOW_DELETE ?? "").trim().toLowerCase() === "true";

const BUSINESS_SLUG = (process.env.BUSINESS_SLUG ?? "wego").trim() || "wego";
const TASK_SUBCOLLECTIONS = ["comments", "attachments", "links", "activity", "reads"] as const;

function maskEmail(value: unknown) {
  if (typeof value !== "string" || !value.includes("@")) return "(none)";
  const [local, domain] = value.split("@");
  const localMask = `${(local ?? "").slice(0, 1)}***`;
  const domainMask = `${(domain ?? "").slice(0, 1)}***.${(domain ?? "").split(".").pop() ?? "*"}`;
  return `${localMask}@${domainMask}`;
}

function maskUid(value: unknown) {
  if (typeof value !== "string" || value.length < 8) return "(none)";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function countCollection(path: string) {
  const snap = await getAdminDb().collection(path).get();
  return { path, count: snap.size, docs: snap.docs };
}

async function countTaskSubtree(businessId: string, taskIds: string[]) {
  const totals: Record<string, number> = Object.fromEntries(TASK_SUBCOLLECTIONS.map((name) => [name, 0]));
  for (const taskId of taskIds) {
    for (const name of TASK_SUBCOLLECTIONS) {
      const snap = await getAdminDb()
        .collection(`${collections.businesses}/${businessId}/tasks/${taskId}/${name}`)
        .get();
      totals[name] = (totals[name] ?? 0) + snap.size;
    }
  }
  return totals;
}

async function main() {
  if (FORBIDDEN_MODE) {
    console.error("REFUSED: destructive MODE/EXECUTE/ALLOW_DELETE is not supported by this script.");
    process.exit(2);
  }
  if (!DRY_RUN) {
    console.error("REFUSED: set DRY_RUN=true (or MODE=inventory). This script is read-only.");
    process.exit(2);
  }

  console.log("=== WEGO RESET INVENTORY (DRY RUN / READ ONLY) ===");
  console.log("mode: DRY_RUN");
  console.log("destructive_ops: disabled");

  if (!isFirebaseAdminConfigured()) {
    console.log("firebase_admin: NOT_CONFIGURED");
    console.log("project_id: NOT_VERIFIED");
    console.log("business_id: NOT_VERIFIED");
    console.log("counts: NOT_VERIFIED (no Admin credentials in local env)");
    console.log("NOTE: Provide operator .env locally, then re-run with DRY_RUN=true. Do not commit secrets.");
    process.exit(0);
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  const projectId = (
    process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    || "(unknown)"
  ).trim();
  console.log(`project_id: ${projectId}`);

  const businessSnap = await db.collection(collections.businesses).where("slug", "==", BUSINESS_SLUG).limit(1).get();
  if (businessSnap.empty) {
    console.log(`business_slug: ${BUSINESS_SLUG}`);
    console.log("business_id: NOT_FOUND");
    process.exit(0);
  }

  const businessDoc = businessSnap.docs[0]!;
  const businessId = businessDoc.id;
  const business = businessDoc.data();
  const ownerUserId = text(business.ownerUserId);
  console.log(`business_slug: ${BUSINESS_SLUG}`);
  console.log(`business_id: ${businessId}`);
  console.log(`business_status: ${text(business.status) || "(none)"}`);
  console.log(`ownerUserId_masked: ${maskUid(ownerUserId)}`);

  const rootUsers = await countCollection(collections.users);
  const rootBusinesses = await countCollection(collections.businesses);

  const scoped: Record<string, { count: number; docs: QueryDocumentSnapshot[] }> = {};
  for (const name of Object.values(businessCollections)) {
    // comments live under tasks, not as a top-level business collection path
    if (name === "comments") continue;
    const path = `${collections.businesses}/${businessId}/${name}`;
    scoped[name] = await countCollection(path);
  }

  const taskIds = scoped.tasks?.docs.map((docSnap) => docSnap.id) ?? [];
  const taskSubtree = await countTaskSubtree(businessId, taskIds);

  const members = scoped.members?.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      userId: text(data.userId) || docSnap.id,
      role: text(data.role) || "(none)",
      isActive: data.isActive !== false,
      employeeId: text(data.employeeId) || null,
      emailMasked: maskEmail(data.email),
    };
  }) ?? [];

  const owners = members.filter((item) => item.role === "BUSINESS_OWNER");
  const managers = members.filter((item) => item.role === "MANAGER");
  const employees = members.filter((item) => item.role === "EMPLOYEE");

  const keepOwnerUid = ownerUserId || owners[0]?.userId || "";
  console.log("--- members summary (masked) ---");
  console.log(`members_total: ${members.length}`);
  console.log(`owners: ${owners.length}`);
  console.log(`managers: ${managers.length}`);
  console.log(`employees: ${employees.length}`);
  console.log(`keep_owner_uid_masked: ${maskUid(keepOwnerUid)}`);
  for (const member of members) {
    const keep = member.userId === keepOwnerUid;
    console.log(
      `member role=${member.role} active=${member.isActive} uid=${maskUid(member.userId)} email=${member.emailMasked} keep=${keep}`,
    );
  }

  // Multi-business Auth risk: users/*/memberships
  const multiBusiness: string[] = [];
  const platformAdmins: string[] = [];
  for (const userDoc of rootUsers.docs) {
    const data = userDoc.data();
    if (data.platformRole === "SUPER_ADMIN") {
      platformAdmins.push(maskUid(userDoc.id));
    }
    const memberships = await userDoc.ref.collection("memberships").get();
    if (memberships.size > 1) {
      multiBusiness.push(`${maskUid(userDoc.id)} memberships=${memberships.size}`);
    }
  }
  console.log("--- platform / shared accounts ---");
  console.log(`super_admins_masked: ${platformAdmins.length ? platformAdmins.join(", ") : "(none found)"}`);
  console.log(`multi_business_users_masked: ${multiBusiness.length ? multiBusiness.join(" | ") : "(none found)"}`);

  // Auth existence for candidates (read-only)
  let authPresentForOwner = false;
  if (keepOwnerUid) {
    const ownerAuth = await auth.getUser(keepOwnerUid).catch(() => null);
    authPresentForOwner = Boolean(ownerAuth);
  }
  console.log(`owner_auth_present: ${authPresentForOwner}`);

  // Storage listing (read-only prefix count when possible)
  let storageObjects: number | "NOT_VERIFIED" = "NOT_VERIFIED";
  try {
    if (getAdminBucketName()) {
      const [files] = await getAdminBucket().getFiles({ prefix: `businesses/${businessId}/`, autoPaginate: true });
      storageObjects = files.length;
    }
  } catch {
    storageObjects = "NOT_VERIFIED";
  }

  console.log("--- collection counts ---");
  console.log(`users(root): ${rootUsers.count}`);
  console.log(`businesses(root): ${rootBusinesses.count}`);
  for (const [name, info] of Object.entries(scoped)) {
    console.log(`businesses/{id}/${name}: ${info.count}`);
  }
  for (const [name, count] of Object.entries(taskSubtree)) {
    console.log(`tasks/*/${name}: ${count}`);
  }
  console.log(`storage_objects_under_business_prefix: ${storageObjects}`);

  const deleteCandidates = {
    projects: scoped.projects?.count ?? 0,
    tasks: scoped.tasks?.count ?? 0,
    taskSubtree,
    meetings: scoped.meetings?.count ?? 0,
    workSessions: scoped.workSessions?.count ?? 0,
    payments: scoped.payments?.count ?? 0,
    paymentAllocations: scoped.paymentAllocations?.count ?? 0,
    movements: scoped.movements?.count ?? 0,
    documents: scoped.documents?.count ?? 0,
    businessDocs: scoped.businessDocs?.count ?? 0,
    clients: scoped.clients?.count ?? 0,
    notifications: scoped.notifications?.count ?? 0,
    notificationDeliveries: scoped.notificationDeliveries?.count ?? 0,
    activityLogs: scoped.activityLogs?.count ?? 0,
    logisticsRequests: scoped.logisticsRequests?.count ?? 0,
    departments: scoped.departments?.count ?? 0,
    departmentCategories: scoped.departmentCategories?.count ?? 0,
    employeesNonOwner: (scoped.employees?.docs ?? []).filter((docSnap) => {
      const data = docSnap.data();
      const uid = text(data.uid) || text(data.userId) || docSnap.id;
      return uid !== keepOwnerUid;
    }).length,
    membersNonOwner: members.filter((item) => item.userId !== keepOwnerUid).length,
    authDeleteCandidates: members.filter((item) => item.userId !== keepOwnerUid).length,
  };

  const keepCandidates = {
    businessDoc: 1,
    ownerAuth: authPresentForOwner ? 1 : 0,
    ownerUserDoc: keepOwnerUid ? 1 : 0,
    ownerMember: keepOwnerUid ? 1 : 0,
    ownerEmployeeMaybe: keepOwnerUid ? 1 : 0,
    settings: scoped.settings?.count ?? 0,
    taskStatuses: scoped.taskStatuses?.count ?? 0,
    termsTemplates: scoped.termsTemplates?.count ?? 0,
    serviceItems: scoped.serviceItems?.count ?? 0,
    taskTemplates: scoped.taskTemplates?.count ?? 0,
    platformAdmins: platformAdmins.length,
  };

  console.log("--- DELETE CANDIDATES (not executed) ---");
  console.log(JSON.stringify(deleteCandidates, null, 2));
  console.log("--- KEEP CANDIDATES (not modified) ---");
  console.log(JSON.stringify(keepCandidates, null, 2));
  console.log("--- UNCLASSIFIED / DECISIONS NEEDED ---");
  console.log("- Keep or wipe clients/businessDocs/payments for legal archive? (decision)");
  console.log("- Keep branding logo in Storage vs re-upload? (decision)");
  console.log("- Keep departments/categories/templates as empty office bootstrap? (decision)");
  console.log("- Any SUPER_ADMIN outside this business must stay. (policy)");
  console.log("- Multi-business Auth users must NOT be deleted from Auth. (policy)");
  console.log("DONE: dry-run complete. No deletes performed.");
}

main().catch((error) => {
  console.error("INVENTORY_FAILED", error instanceof Error ? error.name : "Error");
  process.exit(1);
});
