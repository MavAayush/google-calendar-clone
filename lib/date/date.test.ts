import assert from "assert";
import { toUTC } from "./toUTC";
import { toLocal } from "./toLocal";

const runTests = () => {
  const timezones = ["Asia/Kolkata", "America/New_York", "Europe/London"];
  const localDateTime = "2026-06-27T12:34:56.000";

  for (const tz of timezones) {
    const utcStr = toUTC(localDateTime, tz);
    const roundTripped = toLocal(utcStr, tz);
    assert.strictEqual(roundTripped, localDateTime);
  }

  const allDayLocal = "2026-06-27T15:30:00.000";
  const expectedAllDayLocal = "2026-06-27T00:00:00.000";

  for (const tz of timezones) {
    const utcStr = toUTC(allDayLocal, tz, true);
    const roundTripped = toLocal(utcStr, tz, true);
    assert.strictEqual(roundTripped, expectedAllDayLocal);
  }

  const nyTz = "America/New_York";
  const beforeDst = "2026-03-08T01:30:00.000";
  const afterDst = "2026-03-08T03:30:00.000";

  const utcBefore = toUTC(beforeDst, nyTz);
  const roundTrippedBefore = toLocal(utcBefore, nyTz);
  assert.strictEqual(roundTrippedBefore, beforeDst);

  const utcAfter = toUTC(afterDst, nyTz);
  const roundTrippedAfter = toLocal(utcAfter, nyTz);
  assert.strictEqual(roundTrippedAfter, afterDst);
};

try {
  runTests();
  process.exit(0);
} catch {
  process.exit(1);
}
