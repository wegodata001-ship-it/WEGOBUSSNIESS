import assert from "node:assert/strict";
import { normalizeProjectProgress } from "@/lib/admin/project-progress";

assert.equal(normalizeProjectProgress(undefined), 0);
assert.equal(normalizeProjectProgress(null), 0);
assert.equal(normalizeProjectProgress(""), 0);
assert.equal(normalizeProjectProgress("abc"), 0);
assert.equal(normalizeProjectProgress(-20), 0);
assert.equal(normalizeProjectProgress(150), 100);
assert.equal(normalizeProjectProgress("65"), 65);
assert.equal(normalizeProjectProgress(35.4), 35);
assert.equal(normalizeProjectProgress(35.6), 36);

console.log("PROJECT_PROGRESS_TEST_PASS");
