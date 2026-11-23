/**
 * Read-only inventory for wego-bussniss using Firebase CLI OAuth.
 * Never deletes. Never touches adam-road-system.
 */
import { createRequire } from "node:module";
import { join } from "node:path";

const PROJECT_ID = "wego-bussniss";
const FORBIDDEN = "adam-road-system";
const ACCOUNT_EMAIL = "wegodata001@gmail.com";

if ((PROJECT_ID as string) === FORBIDDEN) {
  console.error("REFUSED");
  process.exit(2);
}

type Doc = { name?: string; fields?: Record<string, Record<string, unknown>> };
type Account = {
  user?: { email?: string };
  tokens?: { refresh_token?: string; scopes?: string[]; access_token?: string; expires_at?: number };
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

function docId(name: string | undefined) {
  return name ? (name.split("/").pop() ?? "") : "";
}

function maskEmail(value: string) {
  if (!value.includes("@")) return value || "(none)";
  const [local, domain] = value.split("@");
  return `${(local ?? "").slice(0, 1)}***@${(domain ?? "").slice(0, 1)}***.${(domain ?? "").split(".").pop() ?? "*"}`;
}

function maskUid(value: string) {
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

async function listDocs(token: string, path: string, pageSize = 300): Promise<Doc[]> {
  const out: Doc[] = [];
  let pageToken = "";
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`);
    url.searchParams.set("pageSize", String(pageSize));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LIST_FAILED ${path} ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { documents?: Doc[]; nextPageToken?: string };
    out.push(...(json.documents ?? []));
    pageToken = json.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

async function main() {
  console.log("=== WEGO DRY-RUN INVENTORY (READ ONLY) ===");
  console.log(`project_id: ${PROJECT_ID}`);
  console.log(`cli_account: ${ACCOUNT_EMAIL}`);
  console.log("destructive_ops: disabled");
  console.log(`forbidden_untouched: ${FORBIDDEN}`);

  const token = await getToken();
  const businesses = await listDocs(token, "businesses");
  console.log(`businesses_count: ${businesses.length}`);

  for (const biz of businesses) {
    console.log(
      `business id=${docId(biz.name)} slug=${fieldString(biz.fields, "slug") || "(none)"} name=${fieldString(biz.fields, "name") || fieldString(biz.fields, "displayName") || "(none)"} owner=${maskUid(fieldString(biz.fields, "ownerUserId"))}`,
    );
  }

  const preferred =
    businesses.find((item) => fieldString(item.fields, "slug") === "wego")
    || businesses[0];
  if (!preferred) {
    console.log("business_id: NOT_FOUND");
    return;
  }

  const businessId = docId(preferred.name);
  const ownerUserId = fieldString(preferred.fields, "ownerUserId");
  console.log(`selected_business_id: ${businessId}`);
  console.log(`selected_owner_uid: ${ownerUserId || "(missing)"}`);
  console.log(`selected_owner_uid_masked: ${maskUid(ownerUserId)}`);

  const collections = [
    "members", "employees", "departments", "departmentCategories", "projects", "tasks",
    "meetings", "workSessions", "logisticsRequests", "notifications", "notificationDeliveries",
    "activityLogs", "settings", "documents", "payments", "paymentAllocations", "clients",
    "businessDocs", "termsTemplates", "serviceItems", "taskTemplates", "taskStatuses", "movements",
  ] as const;

  const counts: Record<string, number> = {};
  for (const name of collections) {
    try {
      counts[name] = (await listDocs(token, `businesses/${businessId}/${name}`)).length;
    } catch (error) {
      counts[name] = -1;
      console.log(`count_error ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("--- collection counts ---");
  for (const [name, count] of Object.entries(counts)) console.log(`${name}: ${count}`);

  const members = await listDocs(token, `businesses/${businessId}/members`).catch(() => [] as Doc[]);
  console.log("--- members (masked) ---");
  let ownerEmail = "";
  for (const member of members) {
    const uid = docId(member.name);
    const role = fieldString(member.fields, "role");
    const email = fieldString(member.fields, "email");
    const keep = Boolean(ownerUserId && uid === ownerUserId) || role === "BUSINESS_OWNER";
    if (keep && email) ownerEmail = email;
    console.log(`role=${role || "(none)"} uid=${maskUid(uid)} email=${maskEmail(email)} keep=${keep}`);
  }
  if (ownerEmail) {
    console.log(`owner_email_masked: ${maskEmail(ownerEmail)}`);
    console.log(`owner_email: ${ownerEmail}`);
  }

  try {
    const ownerUser = await listDocs(token, "users").then(async () => {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${ownerUserId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return res.ok ? ((await res.json()) as Doc) : null;
    });
    if (ownerUser?.fields) {
      console.log(`owner_user_email: ${fieldString(ownerUser.fields, "email") || "(none)"}`);
      console.log(`owner_platformRole: ${fieldString(ownerUser.fields, "platformRole") || "(none)"}`);
    }
    const users = await listDocs(token, "users");
    const supers = users.filter((item) => fieldString(item.fields, "platformRole") === "SUPER_ADMIN");
    console.log(`super_admins_count: ${supers.length}`);
    for (const item of supers) {
      console.log(`super_admin keep_uid=${docId(item.name)} email=${maskEmail(fieldString(item.fields, "email"))}`);
    }
  } catch (error) {
    console.log(`owner_user_lookup_error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const deleteCandidates = {
    projects: counts.projects ?? 0,
    tasks: counts.tasks ?? 0,
    meetings: counts.meetings ?? 0,
    workSessions: counts.workSessions ?? 0,
    notifications: counts.notifications ?? 0,
    notificationDeliveries: counts.notificationDeliveries ?? 0,
    activityLogs: counts.activityLogs ?? 0,
    logisticsRequests: counts.logisticsRequests ?? 0,
    departments: counts.departments ?? 0,
    departmentCategories: counts.departmentCategories ?? 0,
    employees: counts.employees ?? 0,
    membersNonOwner: members.filter((m) => {
      const uid = docId(m.name);
      const role = fieldString(m.fields, "role");
      return uid !== ownerUserId && role !== "BUSINESS_OWNER";
    }).length,
    clients: counts.clients ?? 0,
    legalHoldReview: {
      payments: counts.payments ?? 0,
      paymentAllocations: counts.paymentAllocations ?? 0,
      businessDocs: counts.businessDocs ?? 0,
      documents: counts.documents ?? 0,
      movements: counts.movements ?? 0,
    },
  };

  console.log("--- DELETE CANDIDATES (not executed) ---");
  console.log(JSON.stringify(deleteCandidates, null, 2));
  console.log("--- KEEP ---");
  console.log(JSON.stringify({
    businessDoc: 1,
    ownerUid: ownerUserId || "(unknown)",
    settings: counts.settings ?? 0,
    taskStatuses: counts.taskStatuses ?? 0,
    termsTemplates: counts.termsTemplates ?? 0,
    serviceItems: counts.serviceItems ?? 0,
    taskTemplates: counts.taskTemplates ?? 0,
    brandingLogo: "KEEP",
  }, null, 2));
  console.log("DONE: dry-run only. No deletes.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
