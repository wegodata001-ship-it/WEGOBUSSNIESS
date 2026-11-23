/**
 * EXECUTE wipe for one verified WEGO business.
 * Hard-gated on exact projectId + businessId + ownerUid + ownerEmail.
 * Never touches adam-road-system.
 *
 *   CONFIRM_RESET=YES npx tsx scripts/execute-business-reset.ts
 */
import { createRequire } from "node:module";
import { join } from "node:path";

const EXPECTED = {
  projectId: "wego-bussniss",
  businessId: "fKhGjIhMGnlAKQ43DXON",
  ownerUid: "eLTJf6FaFLOd9W28ci7E5TuKFJ72",
  ownerEmail: "wego.biz24@gmail.com",
} as const;

const FORBIDDEN_PROJECT = "adam-road-system";
const ACCOUNT_EMAIL = "wegodata001@gmail.com";

const DELETE_COLLECTIONS = [
  "projects",
  "tasks",
  "meetings",
  "workSessions",
  "logisticsRequests",
  "notifications",
  "notificationDeliveries",
  "activityLogs",
  "departments",
  "departmentCategories",
  "clients",
] as const;

const KEEP_COLLECTIONS = [
  "settings",
  "taskStatuses",
  "taskTemplates",
  "termsTemplates",
  "serviceItems",
] as const;

type Doc = { name?: string; fields?: Record<string, Record<string, unknown>> };
type Account = {
  user?: { email?: string };
  tokens?: { refresh_token?: string; scopes?: string[] };
};

function loadAuth() {
  const req = createRequire(join(process.env.APPDATA || "", "npm/node_modules/firebase-tools/package.json"));
  return req("./lib/auth.js") as {
    findAccountByEmail: (email: string) => Account | undefined;
    getProjectDefaultAccount: (dir?: string) => Account | undefined;
    getGlobalDefaultAccount: () => Account | undefined;
    getAccessToken: (refreshToken: string, scopes: string[]) => Promise<{ access_token?: string }>;
    setRefreshToken: (token: string) => void;
  };
}

function fieldString(fields: Doc["fields"], key: string): string {
  const raw = fields?.[key];
  if (!raw || typeof raw !== "object") return "";
  if (typeof raw.stringValue === "string") return raw.stringValue;
  return "";
}

function fieldBool(fields: Doc["fields"], key: string): boolean | null {
  const raw = fields?.[key];
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.booleanValue === "boolean") return raw.booleanValue;
  return null;
}

function docId(name: string | undefined) {
  return name ? (name.split("/").pop() ?? "") : "";
}

function mask(value: string) {
  if (!value || value.length < 8) return value || "(none)";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function getToken(): Promise<string> {
  const auth = loadAuth();
  const account =
    auth.findAccountByEmail(ACCOUNT_EMAIL)
    || auth.getProjectDefaultAccount(process.cwd())
    || auth.getGlobalDefaultAccount();
  const refresh = account?.tokens?.refresh_token?.trim() ?? "";
  if (!refresh) throw new Error(`NO_REFRESH_TOKEN for ${ACCOUNT_EMAIL}`);
  const scopes = Array.isArray(account?.tokens?.scopes) ? account!.tokens!.scopes! : [];
  auth.setRefreshToken(refresh);
  const result = await auth.getAccessToken(refresh, scopes);
  const token = result?.access_token?.trim() ?? "";
  if (!token) throw new Error("NO_ACCESS_TOKEN");
  return token;
}

function baseDocsUrl(path = "") {
  const suffix = path ? `/${path}` : "";
  return `https://firestore.googleapis.com/v1/projects/${EXPECTED.projectId}/databases/(default)/documents${suffix}`;
}

async function listDocs(token: string, path: string): Promise<Doc[]> {
  const out: Doc[] = [];
  let pageToken = "";
  do {
    const url = new URL(baseDocsUrl(path));
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`LIST_FAILED ${path} ${res.status}: ${(await res.text()).slice(0, 240)}`);
    const json = (await res.json()) as { documents?: Doc[]; nextPageToken?: string };
    out.push(...(json.documents ?? []));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

async function getDoc(token: string, path: string): Promise<Doc | null> {
  const res = await fetch(baseDocsUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET_FAILED ${path} ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return (await res.json()) as Doc;
}

async function deleteDoc(token: string, path: string) {
  const res = await fetch(baseDocsUrl(path), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE_FAILED ${path} ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  return res.status !== 404;
}

async function listCollectionIds(token: string, parentPath: string): Promise<string[]> {
  const url = `${baseDocsUrl(parentPath)}:listCollectionIds`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pageSize: 100 }),
  });
  if (!res.ok) {
    // Some parents may not support listing; treat as empty.
    return [];
  }
  const json = (await res.json()) as { collectionIds?: string[] };
  return json.collectionIds ?? [];
}

async function deleteTree(token: string, path: string, stats: Record<string, number>) {
  const childCollections = await listCollectionIds(token, path);
  for (const collectionId of childCollections) {
    const children = await listDocs(token, `${path}/${collectionId}`);
    for (const child of children) {
      const id = docId(child.name);
      await deleteTree(token, `${path}/${collectionId}/${id}`, stats);
    }
  }
  const deleted = await deleteDoc(token, path);
  if (deleted) {
    const top = path.split("/")[0] || "doc";
    stats[top] = (stats[top] ?? 0) + 1;
  }
}

async function deleteCollection(token: string, businessPath: string, collection: string, stats: Record<string, number>) {
  const docs = await listDocs(token, `${businessPath}/${collection}`);
  for (const doc of docs) {
    const id = docId(doc.name);
    await deleteTree(token, `${businessPath}/${collection}/${id}`, stats);
  }
  stats[`collection:${collection}`] = docs.length;
}

function summarizeFields(fields: Doc["fields"]) {
  const keys = Object.keys(fields || {});
  const interesting: Record<string, string> = {};
  for (const key of ["type", "status", "amount", "description", "note", "reference", "date", "taskId", "projectId", "method", "seedKey", "legacyId"]) {
    const value = fieldString(fields, key);
    if (value) interesting[key] = value;
  }
  return { keys: keys.slice(0, 20), interesting };
}

async function inspectFinance(token: string, businessPath: string) {
  const payments = await listDocs(token, `${businessPath}/payments`);
  const allocations = await listDocs(token, `${businessPath}/paymentAllocations`);
  const movements = await listDocs(token, `${businessPath}/movements`);
  const report = {
    payments: payments.map((doc) => ({ id: docId(doc.name), ...summarizeFields(doc.fields) })),
    allocations: allocations.map((doc) => ({ id: docId(doc.name), ...summarizeFields(doc.fields) })),
    movements: movements.map((doc) => ({ id: docId(doc.name), ...summarizeFields(doc.fields) })),
  };
  console.log("--- finance inspection ---");
  console.log(JSON.stringify(report, null, 2));

  // Conservative legal rule:
  // Delete only if clearly seed/demo/test/zero-value operational noise.
  // Keep anything that looks like a real payment/movement or lacks clear disposable markers.
  function disposable(item: { interesting: Record<string, string>; keys: string[] }) {
    const blob = `${Object.values(item.interesting).join(" ")} ${item.keys.join(" ")}`.toLowerCase();
    const amount = item.interesting.amount || "";
    const seeded = Boolean(item.interesting.seedKey) || blob.includes("seed") || blob.includes("demo") || blob.includes("test");
    const zero = amount === "0" || amount === "0.0" || amount === "0.00";
    return seeded || zero;
  }

  const all = [...report.payments, ...report.allocations, ...report.movements];
  const allDisposable = all.length > 0 && all.every(disposable);
  return { report, allDisposable, counts: { payments: payments.length, allocations: allocations.length, movements: movements.length } };
}

async function listStoragePrefixes(token: string, prefix: string) {
  const bucket = "wego-bussniss.firebasestorage.app";
  const url = new URL(`https://storage.googleapis.com/storage/v1/b/${bucket}/o`);
  url.searchParams.set("prefix", prefix);
  url.searchParams.set("maxResults", "1000");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.log(`storage_list_error: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return [] as string[];
  }
  const json = (await res.json()) as { items?: Array<{ name: string }> };
  return (json.items ?? []).map((item) => item.name);
}

async function deleteStorageObject(token: string, objectName: string) {
  const bucket = "wego-bussniss.firebasestorage.app";
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectName)}`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) {
    console.log(`storage_delete_error ${objectName}: ${res.status}`);
    return false;
  }
  return res.status !== 404;
}

async function deleteAuthUser(token: string, uid: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${EXPECTED.projectId}/accounts:delete`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ localId: uid }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false as const, status: res.status, body: body.slice(0, 240) };
  }
  return { ok: true as const };
}

async function main() {
  if ((process.env.CONFIRM_RESET || "").trim() !== "YES") {
    console.error("REFUSED: set CONFIRM_RESET=YES");
    process.exit(2);
  }
  if ((EXPECTED.projectId as string) === FORBIDDEN_PROJECT) {
    console.error("REFUSED: forbidden project");
    process.exit(2);
  }

  console.log("=== WEGO BUSINESS RESET EXECUTE ===");
  console.log(`project_id: ${EXPECTED.projectId}`);
  console.log(`business_id: ${EXPECTED.businessId}`);
  console.log(`owner_uid: ${EXPECTED.ownerUid}`);
  console.log(`owner_email: ${EXPECTED.ownerEmail}`);

  const token = await getToken();
  const businessPath = `businesses/${EXPECTED.businessId}`;
  const business = await getDoc(token, businessPath);
  if (!business) {
    console.error("ABORT: business not found");
    process.exit(2);
  }

  const slug = fieldString(business.fields, "slug");
  const ownerUserId = fieldString(business.fields, "ownerUserId");
  console.log(`verified_slug: ${slug}`);
  console.log(`verified_ownerUserId: ${ownerUserId}`);

  if (slug !== "wego" || ownerUserId !== EXPECTED.ownerUid) {
    console.error("ABORT: business identity mismatch");
    process.exit(2);
  }

  const ownerUser = await getDoc(token, `users/${EXPECTED.ownerUid}`);
  if (!ownerUser) {
    console.error("ABORT: owner user doc missing");
    process.exit(2);
  }
  const ownerEmail = fieldString(ownerUser.fields, "email").toLowerCase();
  const platformRole = fieldString(ownerUser.fields, "platformRole");
  console.log(`verified_owner_email: ${ownerEmail}`);
  console.log(`owner_platformRole: ${platformRole || "(none)"}`);
  if (ownerEmail !== EXPECTED.ownerEmail.toLowerCase()) {
    console.error("ABORT: owner email mismatch");
    process.exit(2);
  }

  const ownerMember = await getDoc(token, `${businessPath}/members/${EXPECTED.ownerUid}`);
  if (!ownerMember) {
    console.error("ABORT: owner membership missing");
    process.exit(2);
  }
  const ownerRole = fieldString(ownerMember.fields, "role");
  const ownerActive = fieldBool(ownerMember.fields, "isActive");
  console.log(`verified_owner_role: ${ownerRole}`);
  console.log(`verified_owner_active: ${ownerActive}`);
  if (ownerRole !== "BUSINESS_OWNER") {
    console.error("ABORT: owner is not BUSINESS_OWNER");
    process.exit(2);
  }
  if (ownerActive === false) {
    console.error("ABORT: owner membership inactive");
    process.exit(2);
  }

  const finance = await inspectFinance(token, businessPath);
  const deleteFinance = finance.allDisposable;
  console.log(`finance_delete_decision: ${deleteFinance ? "DELETE (disposable/demo markers)" : "KEEP (legal/uncertain)"}`);

  const members = await listDocs(token, `${businessPath}/members`);
  const employees = await listDocs(token, `${businessPath}/employees`);
  const users = await listDocs(token, "users");

  const superAdminUids = new Set(
    users
      .filter((item) => fieldString(item.fields, "platformRole") === "SUPER_ADMIN")
      .map((item) => docId(item.name)),
  );

  const authDeleteCandidates: string[] = [];
  const authSkip: Array<{ uid: string; reason: string }> = [];

  for (const member of members) {
    const uid = docId(member.name);
    if (!uid || uid === EXPECTED.ownerUid) continue;
    if (superAdminUids.has(uid)) {
      authSkip.push({ uid, reason: "SUPER_ADMIN" });
      continue;
    }
    const memberships = await listDocs(token, `users/${uid}/memberships`).catch(() => [] as Doc[]);
    if (memberships.length > 1) {
      authSkip.push({ uid, reason: `multi_business:${memberships.length}` });
      continue;
    }
    authDeleteCandidates.push(uid);
  }

  console.log("--- auth delete candidates ---");
  console.log(JSON.stringify({ authDeleteCandidates: authDeleteCandidates.map(mask), authSkip: authSkip.map((item) => ({ uid: mask(item.uid), reason: item.reason })) }, null, 2));

  const stats: Record<string, number> = {};

  // 1) Delete operational collections (+ recursive subcollections)
  for (const collection of DELETE_COLLECTIONS) {
    console.log(`deleting_collection: ${collection}`);
    await deleteCollection(token, businessPath, collection, stats);
  }

  // 2) Employees except owner-linked
  console.log("deleting_employees_non_owner");
  let employeesDeleted = 0;
  for (const emp of employees) {
    const id = docId(emp.name);
    const uid = fieldString(emp.fields, "uid") || fieldString(emp.fields, "userId") || "";
    const keep = uid === EXPECTED.ownerUid;
    if (keep) {
      console.log(`keep_employee: ${id}`);
      continue;
    }
    await deleteTree(token, `${businessPath}/employees/${id}`, stats);
    employeesDeleted += 1;
  }
  stats["employees_deleted"] = employeesDeleted;

  // 3) Members except owner
  console.log("deleting_members_non_owner");
  let membersDeleted = 0;
  for (const member of members) {
    const uid = docId(member.name);
    if (uid === EXPECTED.ownerUid) {
      console.log(`keep_member: ${uid}`);
      continue;
    }
    await deleteTree(token, `${businessPath}/members/${uid}`, stats);
    // user membership for this business
    await deleteDoc(token, `users/${uid}/memberships/${EXPECTED.businessId}`).catch(() => false);
    membersDeleted += 1;
  }
  stats["members_deleted"] = membersDeleted;

  // 4) Finance conditional
  if (deleteFinance) {
    console.log("deleting_finance_disposable");
    await deleteCollection(token, businessPath, "payments", stats);
    await deleteCollection(token, businessPath, "paymentAllocations", stats);
    await deleteCollection(token, businessPath, "movements", stats);
  } else {
    console.log("keeping_finance_legal_uncertain");
    stats["finance_kept"] = finance.counts.payments + finance.counts.allocations + finance.counts.movements;
  }

  // 5) Storage under business prefix, keep branding/logo-looking paths
  console.log("deleting_storage_operational");
  const objects = await listStoragePrefixes(token, `businesses/${EXPECTED.businessId}/`);
  let storageDeleted = 0;
  let storageKept = 0;
  for (const name of objects) {
    const lower = name.toLowerCase();
    const keep =
      lower.includes("/branding/")
      || lower.includes("/logo")
      || lower.endsWith("/logo.png")
      || lower.endsWith("/logo.jpg")
      || lower.endsWith("/logo.webp");
    if (keep) {
      storageKept += 1;
      continue;
    }
    if (await deleteStorageObject(token, name)) storageDeleted += 1;
  }
  stats["storage_deleted"] = storageDeleted;
  stats["storage_kept"] = storageKept;

  // 6) Auth delete for single-business non-owner users
  console.log("deleting_auth_candidates");
  let authDeleted = 0;
  for (const uid of authDeleteCandidates) {
    // remove user doc tree memberships first already done for this business
    const membershipsLeft = await listDocs(token, `users/${uid}/memberships`).catch(() => [] as Doc[]);
    if (membershipsLeft.length > 0) {
      authSkip.push({ uid, reason: "memberships_remain" });
      continue;
    }
    // delete user doc if exists
    await deleteTree(token, `users/${uid}`, stats).catch(() => undefined);
    const result = await deleteAuthUser(token, uid);
    if (result.ok) authDeleted += 1;
    else {
      authSkip.push({ uid, reason: `auth_delete_failed:${result.status}` });
      console.log(`auth_delete_failed uid=${mask(uid)} status=${result.status} body=${result.body}`);
    }
  }
  stats["auth_deleted"] = authDeleted;

  // Post verification
  console.log("--- post verification ---");
  const remaining: Record<string, number> = {};
  for (const name of [...DELETE_COLLECTIONS, ...KEEP_COLLECTIONS, "members", "employees", "payments", "paymentAllocations", "movements", "documents", "businessDocs"]) {
    remaining[name] = (await listDocs(token, `${businessPath}/${name}`).catch(() => [])).length;
  }
  const ownerMemberAfter = await getDoc(token, `${businessPath}/members/${EXPECTED.ownerUid}`);
  const ownerUserAfter = await getDoc(token, `users/${EXPECTED.ownerUid}`);
  const businessAfter = await getDoc(token, businessPath);

  console.log(JSON.stringify({
    remaining,
    keep_collections: KEEP_COLLECTIONS,
    owner_member_present: Boolean(ownerMemberAfter),
    owner_member_role: ownerMemberAfter ? fieldString(ownerMemberAfter.fields, "role") : null,
    owner_user_present: Boolean(ownerUserAfter),
    owner_user_email: ownerUserAfter ? fieldString(ownerUserAfter.fields, "email") : null,
    business_present: Boolean(businessAfter),
    business_ownerUserId: businessAfter ? fieldString(businessAfter.fields, "ownerUserId") : null,
    stats,
    auth_skip: authSkip.map((item) => ({ uid: mask(item.uid), reason: item.reason })),
    finance_decision: deleteFinance ? "DELETED" : "KEPT",
  }, null, 2));
  console.log("DONE");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
