import assert from "assert";
import { eventInputSchema } from "./event";
import { recurrenceInputSchema } from "./recurrence";
import { editScopeSchema } from "./editScope";

const runTests = () => {
  const validEvent = {
    title: "Project Sync",
    description: "Weekly synchronization",
    startTime: "2026-06-27T12:00:00Z",
    endTime: "2026-06-27T13:00:00Z",
    allDay: false,
  };
  assert.ok(eventInputSchema.safeParse(validEvent).success);

  const invalidEventTitle = { ...validEvent, title: "" };
  assert.ok(!eventInputSchema.safeParse(invalidEventTitle).success);

  const invalidEventTime = {
    ...validEvent,
    startTime: "2026-06-27T14:00:00Z",
    endTime: "2026-06-27T13:00:00Z",
  };
  assert.ok(!eventInputSchema.safeParse(invalidEventTime).success);

  const invalidEventFormat = { ...validEvent, startTime: "2026-06-27 12:00:00" };
  assert.ok(!eventInputSchema.safeParse(invalidEventFormat).success);

  const validRecurrenceDaily = {
    frequency: "DAILY" as const,
    interval: 1,
  };
  assert.ok(recurrenceInputSchema.safeParse(validRecurrenceDaily).success);

  const validRecurrenceWeekly = {
    frequency: "WEEKLY" as const,
    interval: 2,
    byDay: ["MO", "WE"] as const,
    seriesEndDate: "2026-08-27",
  };
  assert.ok(recurrenceInputSchema.safeParse(validRecurrenceWeekly).success);

  const invalidRecurrenceInterval = {
    frequency: "DAILY" as const,
    interval: 0,
  };
  assert.ok(!recurrenceInputSchema.safeParse(invalidRecurrenceInterval).success);

  const invalidRecurrenceDailyByDay = {
    frequency: "DAILY" as const,
    interval: 1,
    byDay: ["MO"] as const,
  };
  assert.ok(!recurrenceInputSchema.safeParse(invalidRecurrenceDailyByDay).success);

  const invalidRecurrenceDateFormat = {
    frequency: "DAILY" as const,
    interval: 1,
    seriesEndDate: "27-06-2026",
  };
  assert.ok(!recurrenceInputSchema.safeParse(invalidRecurrenceDateFormat).success);

  assert.ok(editScopeSchema.safeParse("THIS").success);
  assert.ok(editScopeSchema.safeParse("THIS_AND_FOLLOWING").success);
  assert.ok(editScopeSchema.safeParse("ALL").success);
  assert.ok(!editScopeSchema.safeParse("INVALID_SCOPE").success);
};

try {
  runTests();
  process.exit(0);
} catch {
  process.exit(1);
}
