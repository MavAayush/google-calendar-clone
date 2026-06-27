import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/middleware/errors";
import { withValidation } from "@/middleware/validate";
import { eventInputSchema, EventInput } from "@/lib/validation/event";
import { getCurrentUserId } from "@/lib/auth";
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
  const userId = await getCurrentUserId(request);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  const timezone = user?.timezone || "UTC";

  const dbEvents = await prisma.event.findMany({
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

  return NextResponse.json({ events: results });
});

export const POST = withErrorHandling(
  withValidation(eventInputSchema, async (request: Request, body: EventInput): Promise<Response> => {
    const userId = await getCurrentUserId(request);

    const conflicts = await findConflictingEvents(
      userId,
      new Date(body.startTime),
      new Date(body.endTime)
    );

    let recurrenceRuleId: string | undefined = undefined;

    if (body.recurrenceRule) {
      const rec = await prisma.recurrenceRule.create({
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

    const event = await prisma.event.create({
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
    return NextResponse.json(formattedEvent, { status });
  })
);
