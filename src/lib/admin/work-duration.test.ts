import assert from "node:assert/strict";
import {
  clockLabelMinutesDelta,
  durationMinutesBetween,
  formatDurationForExport,
  formatDurationWords,
  formatHoursMinutes,
  normalizeDurationMinutes,
  splitDuration,
  sumMinutes,
} from "@/lib/admin/work-duration";

function pass(name: string) {
  console.log(`PASS ${name}`);
}

// --- rounding from original timestamps (08:50 → 11:29 case) ---
{
  // Labels look like 159 minutes, but hidden seconds yield 158 after one Math.round.
  // 08:50:50 → 11:29:10 = 2h 38m 20s = 158.333… → 158
  const start = Date.parse("2026-11-24T06:50:50.000Z"); // 08:50:50 Asia/Jerusalem (UTC+2)
  const end = Date.parse("2026-11-24T09:29:10.000Z"); // 11:29:10 Asia/Jerusalem
  const actual = durationMinutesBetween(start, end);
  assert.equal(actual, 158);
  assert.equal(clockLabelMinutesDelta("08:50", "11:29"), 159);
  assert.notEqual(actual, clockLabelMinutesDelta("08:50", "11:29"));
  pass("hidden-seconds-158-vs-label-159");
}

{
  const start = Date.parse("2026-11-24T06:50:00.000Z");
  const end = Date.parse("2026-11-24T09:29:00.000Z");
  assert.equal(durationMinutesBetween(start, end), 159);
  pass("exact-minute-boundaries-159");
}

{
  // 158.4 min → 158; 158.5 min → 159 (single round)
  const start = 0;
  assert.equal(durationMinutesBetween(start, 158.4 * 60_000), 158);
  assert.equal(durationMinutesBetween(start, 158.5 * 60_000), 159);
  assert.equal(normalizeDurationMinutes(158.4), 158);
  assert.equal(normalizeDurationMinutes(158.6), 159);
  pass("half-up-round-once");
}

// --- formatting ---
{
  assert.equal(formatDurationWords(90, "he"), "שעה ו-30 דקות");
  assert.equal(formatDurationWords(135, "he"), "2 שעות ו-15 דקות");
  assert.equal(formatDurationWords(480, "he"), "8 שעות");
  assert.equal(formatDurationWords(158, "he"), "2 שעות ו-38 דקות");
  assert.equal(formatDurationWords(1, "he"), "דקה");
  assert.equal(formatDurationWords(0, "he"), "0 דקות");
  assert.equal(formatDurationWords(90, "ar"), "ساعة و-30 دقائق");
  assert.equal(formatDurationWords(135, "ar"), "2 ساعات و-15 دقائق");
  assert.equal(formatHoursMinutes(90), "1:30");
  assert.equal(formatHoursMinutes(158), "2:38");
  assert.equal(formatDurationForExport(480, "he"), "8 שעות");
  pass("format-words-and-hhmm");
}

{
  // Sum first, format once — avoid rounding each row into the total.
  const total = sumMinutes([158.4, 158.4, 158.4]);
  assert.equal(total, 158 + 158 + 158);
  assert.equal(formatDurationWords(total, "he"), "7 שעות ו-54 דקות");
  const parts = splitDuration(total);
  assert.equal(parts.hours, 7);
  assert.equal(parts.minutes, 54);
  pass("sum-then-format");
}

// --- midnight crossing (absolute timestamps) ---
{
  const start = Date.parse("2026-11-24T21:30:00.000Z"); // 23:30 IL
  const end = Date.parse("2026-11-24T23:15:00.000Z"); // 01:15 IL next calendar day
  assert.equal(durationMinutesBetween(start, end), 105);
  assert.equal(clockLabelMinutesDelta("23:30", "01:15"), 105);
  assert.equal(formatDurationWords(105, "he"), "שעה ו-45 דקות");
  pass("midnight-crossing");
}

// --- DST spring forward Israel 2025-03-28 02:00 → 03:00 ---
// Absolute ms duration is authoritative (not wall-clock labels).
{
  // Asia/Jerusalem: 2025-03-28 01:30 IST (UTC+2) → 2025-03-28 04:30 IDT (UTC+3)
  // Wall clock advances 3h; actual elapsed is 2h because of the skipped hour.
  const start = new Date("2025-03-28T01:30:00+02:00").getTime();
  const end = new Date("2025-03-28T04:30:00+03:00").getTime();
  assert.equal(durationMinutesBetween(start, end), 120);
  assert.equal(formatDurationWords(120, "he"), "2 שעות");
  // Wall labels alone would look like 3 hours — we do not use labels for duration.
  assert.equal(clockLabelMinutesDelta("01:30", "04:30"), 180);
  pass("dst-spring-forward-absolute-ms");
}

{
  // Autumn fallback 2025-10-26 02:00 IDT → 01:00 IST: wall 01:30→03:30 can be 3h actual.
  const start = new Date("2025-10-26T01:30:00+03:00").getTime();
  const end = new Date("2025-10-26T03:30:00+02:00").getTime();
  assert.equal(durationMinutesBetween(start, end), 180);
  pass("dst-fall-back-absolute-ms");
}

{
  assert.equal(durationMinutesBetween(null, Date.now()), 0);
  assert.equal(durationMinutesBetween(1000, 500), 0);
  pass("invalid-ranges");
}

console.log("WORK_DURATION_PASS");
