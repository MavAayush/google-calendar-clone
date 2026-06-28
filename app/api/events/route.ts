import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/middleware/errors";
import { withValidation } from "@/middleware/validate";
import { eventInputSchema, EventInput } from "@/lib/validation/event";
import { getCurrentUserId, getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db/client";
import { findConflictingEvents } from "@/lib/db/conflicts";
import { expandEventSeries, ExpandedInstance, EventWithRecurrence } from "@/lib/recurrence/expand";

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
    const { event, conflicts } = await prisma.$transaction(async (tx) => {
      const dbConflicts = await tx.event.findMany({
        where: {
          userId,
          startTime: { lt: new Date(body.endTime) },
          endTime: { gt: new Date(body.startTime) },
        },
      });

      const conflictsMapped = dbConflicts.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime.toISOString(),
        allDay: e.allDay,
        isRecurring: false,
        recurrence: null,
        version: e.version,
      }));

      let recurrenceRuleId: string | undefined = undefined;

      if (body.recurrenceRule) {
        const rec = await tx.recurrenceRule.create({
          data: {
            frequency: body.recurrenceRule.frequency,
            interval: body.recurrenceRule.interval,
            seriesStartDate: new Date(body.startTime),
            seriesEndDate: body.recurrenceRule.seriesEndDate ? new Date(body.recurrenceRule.seriesEndDate) : null,
            byDay: body.recurrenceRule.byDay || undefined,
          },
        });
        recurrenceRuleId = rec.id;
      }

      const createdEvent = await tx.event.create({
        data: {
          userId,
          title: body.title,
          description: body.description || null,
          startTime: new Date(body.startTime),
          endTime: new Date(body.endTime),
          allDay: body.allDay,
          recurrenceRuleId,
        },
        include: {
          recurrenceRule: true,
        },
      });

      return { event: createdEvent, conflicts: conflictsMapped };
    });
    console.timeEnd("POST_db_transaction");

    const formattedEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      allDay: event.allDay,
      isRecurring: !!event.recurrenceRule,
      recurrence: event.recurrenceRule ? {
        frequency: event.recurrenceRule.frequency,
        interval: event.recurrenceRule.interval,
        seriesEndDate: event.recurrenceRule.seriesEndDate
          ? event.recurrenceRule.seriesEndDate.toISOString().split("T")[0]
          : null,
        byDay: event.recurrenceRule.byDay,
      } : null,
      version: event.version,
      conflicts,
    };

    const status = conflicts.length > 0 ? 200 : 201;
    console.timeEnd("POST_total");
    return NextResponse.json(formattedEvent, { status });
  })
);
