import assert from "node:assert/strict";
import { parseLegacyDateTime } from "@/lib/dates/legacy";

const a = parseLegacyDateTime("9/15/2026 9:49:58");
assert.ok(a);
assert.equal(a.dateOnly, "2026-09-15");
assert.equal(a.timeOnly, "09:49:58");

const b = parseLegacyDateTime("18/09/2026 18:30:44");
assert.ok(b);
assert.equal(b.dateOnly, "2026-09-18");
assert.equal(b.timeOnly, "18:30:44");

const c = parseLegacyDateTime("2026-09-15 09:49:58");
assert.ok(c);
assert.equal(c.dateOnly, "2026-09-15");
assert.equal(c.timeOnly, "09:49:58");

assert.equal(parseLegacyDateTime("NULL"), null);
assert.equal(parseLegacyDateTime(""), null);
assert.equal(parseLegacyDateTime("not-a-date"), null);

console.log("LEGACY_DATE_TEST_PASS");
