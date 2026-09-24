import assert from "node:assert/strict";
import { toSafeDate, toTimestamp } from "@/lib/dates/timestamp";

assert.equal(toTimestamp(null), 0);
assert.equal(toTimestamp(undefined), 0);
assert.equal(toTimestamp(""), 0);
assert.equal(toTimestamp("not-a-date"), 0);
assert.equal(toTimestamp({}), 0);

const date = new Date("2026-09-24T09:30:00.000Z");
assert.equal(toTimestamp(date), date.getTime());
assert.equal(toTimestamp(date.toISOString()), date.getTime());
assert.equal(toTimestamp(date.getTime()), date.getTime());
assert.equal(toTimestamp(Math.floor(date.getTime() / 1000)), date.getTime());
assert.equal(toTimestamp({ seconds: 1758706200, nanoseconds: 0 }), 1758706200 * 1000);
assert.equal(toTimestamp({ _seconds: 1758706200, _nanoseconds: 0 }), 1758706200 * 1000);
assert.equal(toTimestamp({ toDate: () => date }), date.getTime());
assert.equal(toTimestamp({ $date: date.toISOString() }), date.getTime());
assert.equal(toSafeDate(date)?.getTime(), date.getTime());
assert.equal(toSafeDate(null), null);

console.log("TIMESTAMP_TEST_PASS");
