import assert from "node:assert/strict";
import { computeProjectProgress, isCompletedTaskStatus, normalizeProjectProgress } from "@/lib/admin/project-progress";

assert.equal(normalizeProjectProgress(undefined), 0);
assert.equal(normalizeProjectProgress(null), 0);
assert.equal(normalizeProjectProgress(""), 0);
assert.equal(normalizeProjectProgress("abc"), 0);
assert.equal(normalizeProjectProgress(-20), 0);
assert.equal(normalizeProjectProgress(150), 100);
assert.equal(normalizeProjectProgress("65"), 65);
assert.equal(normalizeProjectProgress(35.4), 35);
assert.equal(normalizeProjectProgress(35.6), 36);

assert.equal(isCompletedTaskStatus("COMPLETED"), true);
assert.equal(isCompletedTaskStatus("DONE"), true);
assert.equal(isCompletedTaskStatus("IN_PROGRESS"), false);
assert.equal(computeProjectProgress([]), 0);
assert.equal(computeProjectProgress([
  { status: "COMPLETED" },
  { status: "DONE" },
  { status: "TODO" },
  { status: "IN_PROGRESS" },
  { status: "TODO" },
  { status: "TODO" },
  { status: "TODO" },
  { status: "TODO" },
  { status: "TODO" },
  { status: "TODO" },
]), 20);
assert.equal(computeProjectProgress(Array.from({ length: 10 }, (_, index) => ({ status: index < 7 ? "COMPLETED" : "TODO" }))), 70);
assert.equal(computeProjectProgress(Array.from({ length: 10 }, (_, index) => ({ status: index < 8 ? "COMPLETED" : "TODO" }))), 80);

console.log("PROJECT_PROGRESS_TEST_PASS");
