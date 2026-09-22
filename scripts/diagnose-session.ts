import { loadProjectEnv } from "./load-env";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "../src/lib/firebase/admin";
import { toAppUser, toBusiness, toMembership } from "../src/lib/firebase/converters";
import { businessDocPath, memberDocPath, userDocPath } from "../src/lib/firebase/paths";

loadProjectEnv();

async function main() {
  if (!isFirebaseAdminConfigured()) {
    console.error("WAITING_FOR_FIREBASE_CONFIG");
    process.exit(1);
  }

  const email = process.argv[2] || "wego.biz24@gmail.com";
  const auth = getAdminAuth();
  const db = getAdminDb();
  const userRecord = await auth.getUserByEmail(email);
  const userSnap = await db.doc(userDocPath(userRecord.uid)).get();
  console.log("ADMIN_USER_DOC", userSnap.exists ? "PASS" : "FAIL");
  if (!userSnap.exists) process.exit(1);

  const user = toAppUser(userSnap.id, userSnap.data()!);
  console.log("ADMIN_USER_ACTIVE", user.isActive ? "PASS" : "FAIL");
  console.log("ADMIN_DEFAULT_BUSINESS", user.defaultBusinessId ? "PASS" : "FAIL");

  if (!user.defaultBusinessId) process.exit(1);

  const [businessSnap, memberSnap] = await Promise.all([
    db.doc(businessDocPath(user.defaultBusinessId)).get(),
    db.doc(memberDocPath(user.defaultBusinessId, userRecord.uid)).get(),
  ]);
  console.log("ADMIN_BUSINESS_DOC", businessSnap.exists ? "PASS" : "FAIL");
  console.log("ADMIN_MEMBER_DOC", memberSnap.exists ? "PASS" : "FAIL");

  if (businessSnap.exists) {
    const business = toBusiness(businessSnap.id, businessSnap.data()!);
    console.log("ADMIN_BUSINESS_STATUS", business.status);
  }
  if (memberSnap.exists) {
    const membership = toMembership(memberSnap.data()!, user.defaultBusinessId);
    console.log("ADMIN_MEMBER_ROLE", membership.role);
    console.log("ADMIN_MEMBER_ACTIVE", membership.isActive ? "PASS" : "FAIL");
  }

  const customToken = await auth.createCustomToken(userRecord.uid);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    console.error("MISSING_API_KEY");
    process.exit(1);
  }

  const tokenResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const tokenPayload = (await tokenResponse.json()) as { idToken?: string; error?: { message?: string } };
  console.log("ID_TOKEN", tokenPayload.idToken ? "PASS" : "FAIL");
  if (!tokenPayload.idToken) {
    console.log("ID_TOKEN_ERROR", tokenPayload.error?.message ?? "unknown");
    process.exit(1);
  }

  const resolveResponse = await fetch("http://localhost:3000/api/session/resolve", {
    headers: { Authorization: `Bearer ${tokenPayload.idToken}` },
  });
  const resolvePayload = (await resolveResponse.json()) as {
    status?: string;
    reason?: string;
    user?: { email?: string };
    business?: { name?: string };
    membership?: { role?: string };
  };
  console.log("RESOLVE_HTTP", resolveResponse.status);
  console.log("RESOLVE_STATUS", resolvePayload.status ?? "MISSING");
  console.log("RESOLVE_REASON", resolvePayload.reason ?? "none");
  console.log("RESOLVE_EMAIL_MATCH", resolvePayload.user?.email === email ? "PASS" : "FAIL");
  console.log("RESOLVE_BUSINESS", resolvePayload.business?.name ? "PASS" : "FAIL");
  console.log("RESOLVE_ROLE", resolvePayload.membership?.role ?? "MISSING");

  if (user.defaultBusinessId) {
    const recordsResponse = await fetch(
      `http://localhost:3000/api/business/records?businessId=${encodeURIComponent(user.defaultBusinessId)}&kind=tasks`,
      { headers: { Authorization: `Bearer ${tokenPayload.idToken}` } },
    );
    const recordsPayload = (await recordsResponse.json()) as { data?: unknown[]; error?: string };
    console.log("TASKS_HTTP", recordsResponse.status);
    console.log("TASKS_COUNT", Array.isArray(recordsPayload.data) ? recordsPayload.data.length : "FAIL");
  }
}

main().catch((error) => {
  console.error("DIAGNOSE_FAILED", error instanceof Error ? error.message : "error");
  process.exit(1);
});
