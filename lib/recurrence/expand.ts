import { addDays, addWeeks, addMonths, startOfWeek } from "date-fns";
import { formatInTimeZone } from "@/lib/date/formatInTimeZone";
import { toUTC } from "@/lib/date/toUTC";
import { toLocal } from "@/lib/date/toLocal";
import { Event, RecurrenceRule, RecurrenceException } from "@prisma/client";
import { fromZonedTime } from "@/lib/date/toUTC";

export type EventWithRecurrence = Event & {
  recurrenceRule: RecurrenceRule | null;
  exceptions: (RecurrenceException & {
    overrideEvent: (Event & { recurrenceRule: RecurrenceRule | null }) | null;
  })[];
};

export interface ExpandedInstance {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  isRecurring: boolean;
  recurrence: {
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    interval: number;
    seriesEndDate: string | null;
    byDay: string[] | null;
  } | null;
  version: number;
  isException?: boolean;
}

export function expandEventSeries(
  event: EventWithRecurrence,
  queryStart: Date,
  queryEnd: Date,
  timezone: string
): ExpandedInstance[] {
  const rule = event.recurrenceRule;
  if (!rule) {
    return [];
  }

  const seriesStartStr = formatInTimeZone(rule.seriesStartDate, timezone, "yyyy-MM-dd");
  const seriesEndStr = rule.seriesEndDate
    ? formatInTimeZone(rule.seriesEndDate, timezone, "yyyy-MM-dd")
    : null;

  const queryStartStr = formatInTimeZone(queryStart, timezone, "yyyy-MM-dd");
  const queryEndStr = formatInTimeZone(queryEnd, timezone, "yyyy-MM-dd");

  const candidates: string[] = [];
  const anchorDate = fromZonedTime(seriesStartStr + "T00:00:00.000", timezone);

  if (rule.frequency === "DAILY") {
    let step = 0;
    while (true) {
      const currentDate = addDays(anchorDate, step * rule.interval);
      const dateStr = formatInTimeZone(currentDate, timezone, "yyyy-MM-dd");
      if (dateStr > queryEndStr) break;
      if (seriesEndStr && dateStr > seriesEndStr) break;

      if (dateStr >= queryStartStr && dateStr >= seriesStartStr) {
        candidates.push(dateStr);
      }
      step++;
    }
  } else if (rule.frequency === "WEEKLY") {
    const startOfWeekDate = startOfWeek(anchorDate, { weekStartsOn: 0 });
    const daysOfWeek = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const byDay = rule.byDay as string[] | null;
    const anchorDayName = formatInTimeZone(anchorDate, timezone, "EEEEEE").toUpperCase();
    const daysToMatch = byDay && byDay.length > 0 ? byDay : [anchorDayName];

    let step = 0;
    while (true) {
      const currentWeekStart = addWeeks(startOfWeekDate, step * rule.interval);
      const weekDays: string[] = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(currentWeekStart, d);
        weekDays.push(formatInTimeZone(day, timezone, "yyyy-MM-dd"));
      }

      if (weekDays[0] > queryEndStr) break;
      if (seriesEndStr && weekDays[0] > seriesEndStr) break;

      for (let d = 0; d < 7; d++) {
        const dayStr = weekDays[d];
        if (dayStr < seriesStartStr) continue;
        if (dayStr > queryEndStr) continue;
        if (seriesEndStr && dayStr > seriesEndStr) continue;

        const dayName = daysOfWeek[d];
        if (daysToMatch.includes(dayName)) {
          if (dayStr >= queryStartStr) {
            candidates.push(dayStr);
          }
        }
      }
      step++;
    }
  } else if (rule.frequency === "MONTHLY") {
    const targetDayOfMonth = parseInt(formatInTimeZone(anchorDate, timezone, "d"));
    let step = 0;
    while (true) {
      const currentDate = addMonths(anchorDate, step * rule.interval);
      const dateStr = formatInTimeZone(currentDate, timezone, "yyyy-MM-dd");
      if (dateStr > queryEndStr) break;
      if (seriesEndStr && dateStr > seriesEndStr) break;

      if (parseInt(formatInTimeZone(currentDate, timezone, "d")) === targetDayOfMonth) {
        if (dateStr >= queryStartStr && dateStr >= seriesStartStr) {
          candidates.push(dateStr);
        }
      }
      step++;
    }
  }

  const durationMs = event.endTime.getTime() - event.startTime.getTime();
  const localStartStr = toLocal(event.startTime.toISOString(), timezone, event.allDay);
  const timePart = localStartStr.split("T")[1];

  const results: ExpandedInstance[] = [];

  for (const dateStr of candidates) {
    const exception = event.exceptions.find((e) => {
      const excDateStr = formatInTimeZone(e.instanceDate, timezone, "yyyy-MM-dd");
      return excDateStr === dateStr;
    });

    if (exception) {
      if (exception.exceptionType === "CANCELLED") {
        continue;
      }
      if (exception.exceptionType === "MODIFIED") {
        if (exception.overrideEvent) {
          results.push({
            id: `${event.id}-${dateStr}`,
            title: exception.overrideEvent.title,
            description: exception.overrideEvent.description,
            startTime: exception.overrideEvent.startTime.toISOString(),
            endTime: exception.overrideEvent.endTime.toISOString(),
            allDay: exception.overrideEvent.allDay,
            isRecurring: true,
            recurrence: {
              frequency: rule.frequency,
              interval: rule.interval,
              seriesEndDate: rule.seriesEndDate ? seriesEndStr : null,
              byDay: rule.byDay as string[] | null,
            },
            version: exception.overrideEvent.version,
            isException: true,
          });
        }
        continue;
      }
    }

    const instanceStartUTC = toUTC(`${dateStr}T${timePart}`, timezone, event.allDay);
    const instanceEndUTC = new Date(new Date(instanceStartUTC).getTime() + durationMs).toISOString();

    results.push({
      id: `${event.id}-${dateStr}`,
      title: event.title,
      description: event.description,
      startTime: instanceStartUTC,
      endTime: instanceEndUTC,
      allDay: event.allDay,
      isRecurring: true,
      recurrence: {
        frequency: rule.frequency,
        interval: rule.interval,
        seriesEndDate: rule.seriesEndDate ? seriesEndStr : null,
        byDay: rule.byDay as string[] | null,
      },
      version: event.version,
    });
  }

  // Handle rescheduled modified events whose original instanceDate is outside the query window
  for (const exception of event.exceptions) {
    if (exception.exceptionType === "MODIFIED" && exception.overrideEvent) {
      const excDateStr = formatInTimeZone(exception.instanceDate, timezone, "yyyy-MM-dd");
      // If it was already added (meaning its original date was within the candidates and query window), skip it
      if (candidates.includes(excDateStr)) {
        continue;
      }

      // Check if the override event falls within the query window
      const overrideStart = exception.overrideEvent.startTime;
      const overrideEnd = exception.overrideEvent.endTime;
      const queryStartMs = queryStart.getTime();
      const queryEndMs = queryEnd.getTime();

      if (overrideStart.getTime() < queryEndMs && overrideEnd.getTime() > queryStartMs) {
        results.push({
          id: `${event.id}-${excDateStr}`,
          title: exception.overrideEvent.title,
          description: exception.overrideEvent.description,
          startTime: exception.overrideEvent.startTime.toISOString(),
          endTime: exception.overrideEvent.endTime.toISOString(),
          allDay: exception.overrideEvent.allDay,
          isRecurring: true,
          recurrence: {
            frequency: rule.frequency,
            interval: rule.interval,
            seriesEndDate: rule.seriesEndDate ? seriesEndStr : null,
            byDay: rule.byDay as string[] | null,
          },
          version: exception.overrideEvent.version,
          isException: true,
        });
      }
    }
  }

  return results;
}
