import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/middleware/errors";
import { withValidation } from "@/middleware/validate";
import { eventInputSchema, EventInput } from "@/lib/validation/event";
import { getCurrentUserId, getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db/client";
import { expandEventSeries, ExpandedInstance, EventWithRecurrence } from "@/lib/recurrence/expand";

interface RawQueryResult {
  event_data: {
    id: string;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    allDay: boolean;
    version: number;
    recurrenceRuleId: string | null;
  } | null;
  conflicts_data: {
    id: string;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    allDay: boolean;
    version: number;
  }[];
}

const getEventsQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export const GET = withErrorHandling(async (request: Request): Promise<Response> => {
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const parsedQuery = getEventsQuerySchema.parse({
    start: startParam,
    end: endParam,
  });

  const { start, end } = parsedQuery;
  console.time("GET_total");
  console.time("GET_getCurrentUser");
  const user = await getCurrentUser(request);
  const userId = user.id;
  const timezone = user.timezone;
  console.timeEnd("GET_getCurrentUser");

  console.time("GET_db_events");
  const dbEvents = await prisma.event.findMany({
    relationLoadStrategy: "join",
    where: {
      userId,
      OR: [
        {
          recurrenceRuleId: null,
          startTime: { lt: new Date(end) },
          endTime: { gt: new Date(start) },
        },
        {
          recurrenceRule: {
            seriesStartDate: { lte: new Date(end) },
            OR: [
              { seriesEndDate: null },
              { seriesEndDate: { gte: new Date(start) } },
            ],
          },
        },
      ],
    },
    include: {
      recurrenceRule: {
        include: {
          exceptions: {
            include: {
              overrideEvent: true,
            },
          },
        },
      },
      exceptions: {
        include: {
          overrideEvent: true,
        },
      },
    },
  });
  console.timeEnd("GET_db_events");

  console.time("GET_expansion");
  const results: ExpandedInstance[] = [];

  for (const e of dbEvents) {
    if (!e.recurrenceRule) {
      if (e.exceptions && e.exceptions.length > 0) {
        continue;
      }
      results.push({
        id: e.id,
        title: e.title,
        description: e.description,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        allDay: e.allDay,
        isRecurring: false,
        recurrence: null,
        version: e.version,
      });
    } else {
      const expanded = expandEventSeries(
        {
          ...e,
          exceptions: e.recurrenceRule.exceptions || [],
        } as EventWithRecurrence,
        new Date(start),
        new Date(end),
        timezone
      );
      results.push(...expanded);
    }
  }
  console.timeEnd("GET_expansion");
  console.timeEnd("GET_total");

  return NextResponse.json({ events: results });
});

export const POST = withErrorHandling(
  withValidation(eventInputSchema, async (request: Request, body: EventInput): Promise<Response> => {
    console.time("POST_total");
    console.time("POST_getCurrentUserId");
    const userId = await getCurrentUserId(request);
    console.timeEnd("POST_getCurrentUserId");

    console.time("POST_db_transaction");
    const result = await prisma.$queryRaw<RawQueryResult[]>`
      WITH conflicts AS (
        SELECT id, title, description, start_time, end_time, all_day, version
        FROM events
        WHERE user_id = CAST(${userId} AS uuid)
          AND start_time < CAST(${new Date(body.endTime)} AS timestamptz)
          AND end_time > CAST(${new Date(body.startTime)} AS timestamptz)
      ),
      new_rule AS (
        INSERT INTO recurrence_rules (id, frequency, interval, series_start_date, series_end_date, by_day)
        SELECT gen_random_uuid(), CAST(${body.recurrenceRule?.frequency || null} AS "Frequency"), CAST(${body.recurrenceRule?.interval || null} AS integer), CAST(${body.recurrenceRule ? new Date(body.startTime) : null} AS date), CAST(${body.recurrenceRule?.seriesEndDate ? new Date(body.recurrenceRule.seriesEndDate) : null} AS date), CAST(${body.recurrenceRule?.byDay ? JSON.stringify(body.recurrenceRule.byDay) : null} AS jsonb)
        WHERE CAST(${!!body.recurrenceRule} AS boolean) = true
        RETURNING id
      ),
      inserted_event AS (
        INSERT INTO events (id, user_id, title, description, start_time, end_time, all_day, recurrence_rule_id, version)
        SELECT 
          gen_random_uuid(),
          CAST(${userId} AS uuid),
          CAST(${body.title} AS varchar),
          CAST(${body.description || null} AS text),
          CAST(${new Date(body.startTime)} AS timestamptz),
          CAST(${new Date(body.endTime)} AS timestamptz),
          CAST(${body.allDay} AS boolean),
          (SELECT id FROM new_rule LIMIT 1),
          1
        RETURNING *
      )
      SELECT 
        (SELECT json_build_object(
          'id', id,
          'title', title,
          'description', description,
          'startTime', start_time,
          'endTime', end_time,
          'allDay', all_day,
          'version', version,
          'recurrenceRuleId', recurrence_rule_id
        ) FROM inserted_event) as event_data,
        (SELECT coalesce(json_agg(json_build_object(
          'id', id,
          'title', title,
          'description', description,
          'startTime', start_time,
          'endTime', end_time,
          'allDay', all_day,
          'version', version
        )), '[]'::json) FROM conflicts) as conflicts_data;
    `;
    console.timeEnd("POST_db_transaction");

    const rawEvent = result[0]?.event_data;
    const conflictsData = result[0]?.conflicts_data || [];

    if (!rawEvent) {
      return new Response(
        JSON.stringify({ error: { message: "Failed to create event" } }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const conflicts = conflictsData.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: new Date(e.startTime).toISOString(),
      endTime: new Date(e.endTime).toISOString(),
      allDay: e.allDay,
      isRecurring: false,
      recurrence: null,
      version: e.version,
    }));

    const formattedEvent = {
      id: rawEvent.id,
      title: rawEvent.title,
      description: rawEvent.description,
      startTime: new Date(rawEvent.startTime).toISOString(),
      endTime: new Date(rawEvent.endTime).toISOString(),
      allDay: rawEvent.allDay,
      isRecurring: !!rawEvent.recurrenceRuleId,
      recurrence: body.recurrenceRule ? {
        frequency: body.recurrenceRule.frequency,
        interval: body.recurrenceRule.interval,
        seriesEndDate: body.recurrenceRule.seriesEndDate
          ? new Date(body.recurrenceRule.seriesEndDate).toISOString().split("T")[0]
          : null,
        byDay: body.recurrenceRule.byDay || null,
      } : null,
      version: rawEvent.version,
      conflicts,
    };

    const status = conflicts.length > 0 ? 200 : 201;
    console.timeEnd("POST_total");
    return NextResponse.json(formattedEvent, { status });
  })
);
