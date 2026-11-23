import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  resolveTaskStatusesReadModel,
  sortTaskStatusDefinitions,
  virtualDefaultTaskStatuses,
} from "@/lib/admin/task-status-defaults";
import { DEFAULT_TASK_STATUS_SEEDS } from "@/types/task-status";

const virtual = virtualDefaultTaskStatuses("biz-1", new Date("2026-01-01T00:00:00Z"));
assert.equal(virtual.length, DEFAULT_TASK_STATUS_SEEDS.length);
assert.ok(virtual.every((item) => item.businessId === "biz-1"));
assert.ok(virtual.every((item) => item.isSystem === true));
assert.ok(virtual.some((item) => item.id === "TODO"));
assert.ok(virtual.some((item) => item.id === "PENDING_APPROVAL"));

const sorted = sortTaskStatusDefinitions([
  { ...virtual[2]!, sortOrder: 99 },
  { ...virtual[0]!, sortOrder: 1 },
]);
assert.equal(sorted[0]?.sortOrder, 1);
assert.equal(sorted[1]?.sortOrder, 99);

const emptyRead = resolveTaskStatusesReadModel({ businessId: "biz-empty", docs: [] });
assert.equal(emptyRead.wrote, false);
assert.ok(emptyRead.statuses.length > 0);

const existingRead = resolveTaskStatusesReadModel({
  businessId: "biz-existing",
  docs: [virtual[0]!],
});
assert.equal(existingRead.wrote, false);
assert.equal(existingRead.statuses.length, 1);

const root = process.cwd();
const recordsSrc = readFileSync(join(root, "src/app/api/business/records/route.ts"), "utf8");
const getStatusesSrc = readFileSync(join(root, "src/app/api/business/task-statuses/route.ts"), "utf8");
assert.ok(!recordsSrc.includes("ensureDefaultTaskStatuses"), "records GET must not seed statuses");
assert.ok(!getStatusesSrc.includes("ensureDefaultTaskStatuses"), "task-statuses GET must not seed statuses");
assert.ok(getStatusesSrc.includes("listTaskStatusesReadOnly"));

console.log("TASK_STATUS_READ_PASS");
