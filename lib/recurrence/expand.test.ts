import { expandEventSeries, EventWithRecurrence } from "./expand";
import assert from "assert";

const mockEvent = (overrides: Partial<EventWithRecurrence>): EventWithRecurrence => {
  return {
    id: "anchor-id",
    userId: "user-id",
    title: "Test Event",
    description: "Mock Event for Testing",
    startTime: new Date("2026-06-01T09:00:00Z"),
    endTime: new Date("2026-06-01T10:00:00Z"),
    allDay: false,
    recurrenceRuleId: "rule-id",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    recurrenceRule: {
      id: "rule-id",
      frequency: "DAILY",
      interval: 1,
      seriesStartDate: new Date("2026-06-01T00:00:00Z"),
      seriesEndDate: null,
      byDay: null,
      createdAt: new Date(),
    },
    exceptions: [],
    ...overrides,
  } as EventWithRecurrence;
};

function testDailyRecurrence() {
  const event = mockEvent({
    recurrenceRule: {
      id: "rule-id",
      frequency: "DAILY",
      interval: 2,
      seriesStartDate: new Date("2026-06-01T00:00:00Z"),
      seriesEndDate: new Date("2026-06-10T00:00:00Z"),
      byDay: null,
      createdAt: new Date(),
    },
  });

  const queryStart = new Date("2026-06-01T00:00:00Z");
  const queryEnd = new Date("2026-06-10T23:59:59Z");
  const timezone = "UTC";

  const results = expandEventSeries(event, queryStart, queryEnd, timezone);

  const startTimes = results.map((r) => r.startTime.split("T")[0]);
  assert.deepStrictEqual(startTimes, ["2026-06-01", "2026-06-03", "2026-06-05", "2026-06-07", "2026-06-09"]);
  console.log("✓ testDailyRecurrence passed");
}

function testWeeklyRecurrence() {
  const event = mockEvent({
    startTime: new Date("2026-06-01T09:00:00Z"), // Monday
    endTime: new Date("2026-06-01T10:00:00Z"),
    recurrenceRule: {
      id: "rule-id",
      frequency: "WEEKLY",
      interval: 1,
      seriesStartDate: new Date("2026-06-01T00:00:00Z"),
      seriesEndDate: new Date("2026-06-10T00:00:00Z"),
      byDay: ["MO", "WE"],
      createdAt: new Date(),
    },
  });

  const queryStart = new Date("2026-06-01T00:00:00Z");
  const queryEnd = new Date("2026-06-10T23:59:59Z");
  const timezone = "UTC";

  const results = expandEventSeries(event, queryStart, queryEnd, timezone);

  const startTimes = results.map((r) => r.startTime.split("T")[0]);
  assert.deepStrictEqual(startTimes, ["2026-06-01", "2026-06-03", "2026-06-08", "2026-06-10"]);
  console.log("✓ testWeeklyRecurrence passed");
}

function testMonthlyRecurrenceDaySkip() {
  const event = mockEvent({
    startTime: new Date("2026-08-31T09:00:00Z"),
    endTime: new Date("2026-08-31T10:00:00Z"),
    recurrenceRule: {
      id: "rule-id",
      frequency: "MONTHLY",
      interval: 1,
      seriesStartDate: new Date("2026-08-31T00:00:00Z"),
      seriesEndDate: new Date("2026-11-01T00:00:00Z"),
      byDay: null,
      createdAt: new Date(),
    },
  });

  const queryStart = new Date("2026-08-31T00:00:00Z");
  const queryEnd = new Date("2026-11-01T23:59:59Z");
  const timezone = "UTC";

  const results = expandEventSeries(event, queryStart, queryEnd, timezone);

  const startTimes = results.map((r) => r.startTime.split("T")[0]);
  assert.deepStrictEqual(startTimes, ["2026-08-31", "2026-10-31"]);
  console.log("✓ testMonthlyRecurrenceDaySkip passed");
}

function testExceptionsCancelledAndModified() {
  const event = mockEvent({
    recurrenceRule: {
      id: "rule-id",
      frequency: "DAILY",
      interval: 1,
      seriesStartDate: new Date("2026-06-01T00:00:00Z"),
      seriesEndDate: new Date("2026-06-05T00:00:00Z"),
      byDay: null,
      createdAt: new Date(),
    },
    exceptions: [
      {
        id: "exc-1",
        recurrenceRuleId: "rule-id",
        instanceDate: new Date("2026-06-02T00:00:00Z"),
        exceptionType: "CANCELLED",
        overrideEventId: null,
        overrideEvent: null,
        createdAt: new Date(),
      },
      {
        id: "exc-2",
        recurrenceRuleId: "rule-id",
        instanceDate: new Date("2026-06-04T00:00:00Z"),
        exceptionType: "MODIFIED",
        overrideEventId: "override-event-id",
        overrideEvent: null,
        createdAt: new Date(),
      },
    ],
  });

  const queryStart = new Date("2026-06-01T00:00:00Z");
  const queryEnd = new Date("2026-06-05T23:59:59Z");
  const timezone = "UTC";

  const results = expandEventSeries(event, queryStart, queryEnd, timezone);

  const startTimes = results.map((r) => r.startTime.split("T")[0]);
  assert.deepStrictEqual(startTimes, ["2026-06-01", "2026-06-03", "2026-06-05"]);
  console.log("✓ testExceptionsCancelledAndModified passed");
}

testDailyRecurrence();
testWeeklyRecurrence();
testMonthlyRecurrenceDaySkip();
testExceptionsCancelledAndModified();
console.log("All unit tests run successfully!");
