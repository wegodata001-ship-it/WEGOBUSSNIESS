import assert from "node:assert/strict";
import {
  isAllowedProjectSystemFile,
  isBlockedSecretFileName,
  sanitizeProjectSystemDetails,
  toProjectSystemDetails,
} from "@/lib/admin/project-system-rules";
import { emptyProjectSystemDetails } from "@/types/project-system";

assert.equal(isBlockedSecretFileName(".env"), true);
assert.equal(isBlockedSecretFileName("production.env"), true);
assert.equal(isBlockedSecretFileName("service-account.json"), true);
assert.equal(isBlockedSecretFileName("firebase-adminsdk-key.json"), true);
assert.equal(isBlockedSecretFileName("id_rsa.pem"), true);
assert.equal(isBlockedSecretFileName("specs.pdf"), false);
assert.equal(isBlockedSecretFileName("bundle.zip"), false);

assert.equal(isAllowedProjectSystemFile({ name: "notes.pdf", type: "application/pdf", size: 100 }).ok, true);
assert.equal(isAllowedProjectSystemFile({ name: "archive.zip", type: "application/zip", size: 100 }).ok, true);
assert.equal(isAllowedProjectSystemFile({ name: ".env", type: "text/plain", size: 10 }).ok, false);
assert.equal(isAllowedProjectSystemFile({ name: "secret.env", type: "text/plain", size: 10 }).error, "SECRET_FILE_DENIED");
assert.equal(isAllowedProjectSystemFile({ name: "big.pdf", type: "application/pdf", size: 30 * 1024 * 1024 }).error, "FILE_TOO_LARGE");
assert.equal(isAllowedProjectSystemFile({ name: "x.exe", type: "application/octet-stream", size: 10 }).error, "FILE_TYPE");

const rejected = sanitizeProjectSystemDetails({ systemName: "CRM", password: "plain-secret" });
assert.equal(rejected.ok, false);
if (!rejected.ok) assert.equal(rejected.error, "PASSWORD_PLAINTEXT_FORBIDDEN");

const rejectedAlt = sanitizeProjectSystemDetails({ passwordPlain: "x" });
assert.equal(rejectedAlt.ok, false);

const badUrl = sanitizeProjectSystemDetails({ systemUrl: "not-a-url" });
assert.equal(badUrl.ok, false);

const ok = sanitizeProjectSystemDetails({
  systemName: "CRM",
  systemDescription: "Client portal",
  systemUrl: "https://example.com",
  adminUrl: "https://admin.example.com",
  username: "ops",
  githubUrl: "https://github.com/acme/crm",
  databaseKind: "FIREBASE",
  hostingKind: "VERCEL",
  domain: "example.com",
  domainRenewalDate: "2027-01-15",
  ownerEmployeeId: "e1",
  technicalNotes: "prod",
});
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.data.systemName, "CRM");
  assert.equal(ok.data.passwordConfigured, false);
  assert.equal(ok.data.passwordSecretRef, null);
  assert.equal(ok.data.databaseKind, "FIREBASE");
  assert.equal(ok.data.hostingKind, "VERCEL");
}

const forgedVault = sanitizeProjectSystemDetails(
  { passwordSecretRef: "vault/projects/p1/password", passwordConfigured: true },
  emptyProjectSystemDetails(),
);
assert.equal(forgedVault.ok, true);
if (forgedVault.ok) {
  assert.equal(forgedVault.data.passwordConfigured, false);
  assert.equal(forgedVault.data.passwordSecretRef, null);
}

const preservedVault = sanitizeProjectSystemDetails(
  { systemName: "CRM" },
  {
    ...emptyProjectSystemDetails(),
    passwordConfigured: true,
    passwordSecretRef: "businesses/b1/projectCredentials/p1",
  },
);
assert.equal(preservedVault.ok, true);
if (preservedVault.ok) {
  assert.equal(preservedVault.data.passwordConfigured, true);
  assert.equal(preservedVault.data.passwordSecretRef, "businesses/b1/projectCredentials/p1");
  assert.equal(preservedVault.data.systemName, "CRM");
}

const legacy = toProjectSystemDetails({
  systemName: "Legacy",
  updatedAt: "2026-01-02T10:00:00.000Z",
  updatedByUserId: "u1",
});
assert.equal(legacy.systemName, "Legacy");
assert.ok(legacy.updatedAt instanceof Date);
assert.equal(legacy.updatedByUserId, "u1");

assert.deepEqual(toProjectSystemDetails(null), emptyProjectSystemDetails());

console.log("project-system-rules.test.ts: OK");
