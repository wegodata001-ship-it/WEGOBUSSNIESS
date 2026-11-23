import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  decryptProjectPassword,
  encryptProjectPassword,
  parseProjectCredentialsKey,
  projectCredentialAad,
} from "@/lib/security/project-credentials-crypto";

const key = randomBytes(32);
assert.equal(parseProjectCredentialsKey(key.toString("base64"))?.equals(key), true);
assert.equal(parseProjectCredentialsKey(key.toString("hex"))?.equals(key), true);
assert.equal(parseProjectCredentialsKey("too-short"), null);
assert.equal(parseProjectCredentialsKey(""), null);

const encrypted = encryptProjectPassword({
  plaintext: "S3cret!Value",
  businessId: "biz-1",
  projectId: "proj-1",
  key,
});
assert.ok(!("error" in encrypted));
if (!("error" in encrypted)) {
  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.ok(encrypted.ciphertext);
  assert.ok(encrypted.iv);
  assert.ok(encrypted.authTag);
  assert.notEqual(encrypted.ciphertext.includes("S3cret"), true);

  const ok = decryptProjectPassword({
    record: encrypted,
    businessId: "biz-1",
    projectId: "proj-1",
    key,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.password, "S3cret!Value");

  // Wrong project AAD must fail (cannot move ciphertext across projects).
  const wrongProject = decryptProjectPassword({
    record: encrypted,
    businessId: "biz-1",
    projectId: "proj-OTHER",
    key,
  });
  assert.equal(wrongProject.ok, false);

  const wrongBusiness = decryptProjectPassword({
    record: encrypted,
    businessId: "biz-OTHER",
    projectId: "proj-1",
    key,
  });
  assert.equal(wrongBusiness.ok, false);
}

const empty = encryptProjectPassword({
  plaintext: "",
  businessId: "biz-1",
  projectId: "proj-1",
  key,
});
assert.deepEqual(empty, { error: "EMPTY_PASSWORD" });

const missingKey = encryptProjectPassword({
  plaintext: "x",
  businessId: "biz-1",
  projectId: "proj-1",
  key: null,
});
assert.deepEqual(missingKey, { error: "ENCRYPTION_NOT_CONFIGURED" });

assert.ok(projectCredentialAad("a", "b").includes("a"));
assert.notEqual(
  projectCredentialAad("a", "b").toString("utf8"),
  projectCredentialAad("a", "c").toString("utf8"),
);

console.log("project-credentials-crypto.test.ts: OK");
