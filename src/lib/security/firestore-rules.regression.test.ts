import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const firestore = readFileSync(join(root, "firestore.rules"), "utf8");
const storage = readFileSync(join(root, "storage.rules"), "utf8");

assert.ok(firestore.includes("employeeId == memberEmployeeId(businessId)"));
assert.ok(firestore.includes("canReadTaskDoc"));
assert.ok(firestore.includes("Full roster for assignee chips is served via Admin SDK"));
assert.ok(firestore.includes('match /clients/{clientId}'));
assert.ok(/match \/clients\/\{clientId\} \{[\s\S]*?allow read: if isSuperAdmin\(\) \|\| isOwnerOrManager\(businessId\);/.test(firestore));
assert.ok(storage.includes("projects/{projectId}/system/{allPaths=**}"));
assert.ok(storage.includes("Project system vault files"));
assert.ok(firestore.includes("projectCredentials") && firestore.includes("allow read, write: if false"));

console.log("FIRESTORE_RULES_REGRESSION_PASS");
