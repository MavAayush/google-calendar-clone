import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/middleware/errors";
import { withValidation } from "@/middleware/validate";
import { eventInputSchema, EventInput } from "@/lib/validation/event";
import { getCurrentUserId } from "@/lib/auth";
import prisma from "@/lib/db/client";

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

  const events = await prisma.event.findMany({
    where: {
      userId,
      startTime: { lt: new Date(end) },
      endTime: { gt: new Date(start) },
    },
  });

  const formattedEvents = events.map((e) => ({
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

  return NextResponse.json({ events: formattedEvents });
});

export const POST = withErrorHandling(
  withValidation(eventInputSchema, async (request: Request, body: EventInput): Promise<Response> => {
    const userId = await getCurrentUserId(request);

    const event = await prisma.event.create({
      data: {
        userId,
        title: body.title,
        description: body.description || null,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        allDay: body.allDay,
      },
    });

    const formattedEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      allDay: event.allDay,
      isRecurring: false,
      recurrence: null,
      version: event.version,
    };

    return NextResponse.json(formattedEvent, { status: 201 });
  })
);
