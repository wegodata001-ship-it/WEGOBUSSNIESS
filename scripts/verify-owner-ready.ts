/**
 * Read-only post-reset readiness check. No deletes.
 */
import { createRequire } from "node:module";
import { join } from "node:path";

const PROJECT_ID = "wego-bussniss";
const BUSINESS_ID = "fKhGjIhMGnlAKQ43DXON";
const OWNER_UID = "eLTJf6FaFLOd9W28ci7E5TuKFJ72";
const OWNER_EMAIL = "wego.biz24@gmail.com";

type Doc = { name?: string; fields?: Record<string, Record<string, unknown>> };

function loadAuth() {
  const req = createRequire(join(process.env.APPDATA || "", "npm/node_modules/firebase-tools/package.json"));
  return req("./lib/auth.js") as {
    findAccountByEmail: (email: string) => { tokens?: { refresh_token?: string; scopes?: string[] } } | undefined;
    getProjectDefaultAccount: (dir?: string) => { tokens?: { refresh_token?: string; scopes?: string[] } } | undefined;
    getGlobalDefaultAccount: () => { tokens?: { refresh_token?: string; scopes?: string[] } } | undefined;
    getAccessToken: (refreshToken: string, scopes: string[]) => Promise<{ access_token?: string }>;
    setRefreshToken: (token: string) => void;
  };
}

function s(fields: Doc["fields"], key: string) {
  const raw = fields?.[key];
  return typeof raw?.stringValue === "string" ? raw.stringValue : "";
}

async function main() {
  const auth = loadAuth();
  const account = auth.findAccountByEmail("wegodata001@gmail.com")
    || auth.getProjectDefaultAccount(process.cwd())
    || auth.getGlobalDefaultAccount();
  const refresh = account?.tokens?.refresh_token || "";
  auth.setRefreshToken(refresh);
  const token = (await auth.getAccessToken(refresh, account?.tokens?.scopes || [])).access_token || "";

  const get = async (path: string) => {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as Doc;
  };
  const list = async (path: string) => {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [] as Doc[];
    const json = (await res.json()) as { documents?: Doc[] };
    return json.documents || [];
  };

  const business = await get(`businesses/${BUSINESS_ID}`);
  const member = await get(`businesses/${BUSINESS_ID}/members/${OWNER_UID}`);
  const user = await get(`users/${OWNER_UID}`);
  const projects = await list(`businesses/${BUSINESS_ID}/projects`);
  const employees = await list(`businesses/${BUSINESS_ID}/employees`);
  const members = await list(`businesses/${BUSINESS_ID}/members`);
  const settings = await list(`businesses/${BUSINESS_ID}/settings`);
  const statuses = await list(`businesses/${BUSINESS_ID}/taskStatuses`);

  const authLookup = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ localId: [OWNER_UID] }),
  });
  const authJson = await authLookup.json().catch(() => ({})) as { users?: Array<{ localId?: string; email?: string; disabled?: boolean }> };
  const authUser = authJson.users?.[0];

  console.log(JSON.stringify({
    projectId: PROJECT_ID,
    businessOk: Boolean(business) && s(business?.fields, "ownerUserId") === OWNER_UID,
    memberOk: Boolean(member) && s(member?.fields, "role") === "BUSINESS_OWNER",
    userOk: Boolean(user) && s(user?.fields, "email").toLowerCase() === OWNER_EMAIL,
    authOk: Boolean(authUser) && authUser?.email?.toLowerCase() === OWNER_EMAIL && authUser?.disabled !== true,
    authDisabled: authUser?.disabled === true,
    counts: {
      projects: projects.length,
      employees: employees.length,
      members: members.length,
      settings: settings.length,
      taskStatuses: statuses.length,
    },
    readyForNewData: projects.length === 0 && members.length === 1 && employees.length === 1,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
