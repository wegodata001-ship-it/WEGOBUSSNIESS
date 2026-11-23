import assert from "node:assert/strict";
import {
  buildDatePickerCells,
  normalizeDatePickerValue,
  safeTodayInTimeZone,
  shiftDatePickerMonth,
} from "@/lib/dates/date-picker-model";
import { todayInTimeZone } from "@/lib/dates/format";

assert.equal(normalizeDatePickerValue(undefined), safeTodayInTimeZone());
assert.equal(normalizeDatePickerValue(null), safeTodayInTimeZone());
assert.equal(normalizeDatePickerValue(""), safeTodayInTimeZone());
assert.equal(normalizeDatePickerValue("2026-11-23"), "2026-11-23");
assert.equal(normalizeDatePickerValue("2026-11-23T10:00:00.000Z"), "2026-11-23");

// Regression: opening the picker must not throw on bad value/timezone.
assert.doesNotThrow(() => buildDatePickerCells(undefined));
assert.doesNotThrow(() => buildDatePickerCells(""));
assert.doesNotThrow(() => buildDatePickerCells("bogus"));
assert.doesNotThrow(() => buildDatePickerCells("2026-13-99"));
assert.doesNotThrow(() => todayInTimeZone(""));
assert.doesNotThrow(() => todayInTimeZone("Invalid/Zone"));
assert.doesNotThrow(() => todayInTimeZone(null as unknown as string));

const ok = buildDatePickerCells("2026-11-23");
assert.equal(ok.value, "2026-11-23");
assert.equal(ok.year, 2026);
assert.equal(ok.month, 11);
assert.ok(ok.cells.includes("2026-11-23"));
assert.ok(ok.cells.filter(Boolean).length === 30);

const shifted = shiftDatePickerMonth("2026-01-31", 1);
assert.equal(shifted, "2026-02-28");

assert.doesNotThrow(() => buildDatePickerCells("2026-11-23", ""));
assert.doesNotThrow(() => buildDatePickerCells("2026-11-23", "Invalid/Zone"));

console.log("date-picker-model.test.ts: OK");
