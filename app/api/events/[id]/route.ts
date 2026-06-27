import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling, VersionConflictError } from "@/middleware/errors";
import { withValidation } from "@/middleware/validate";
import { eventInputObjectSchema } from "@/lib/validation/event";
import { getCurrentUserId } from "@/lib/auth";
import prisma from "@/lib/db/client";
import { Prisma } from "@prisma/client";
import { findConflictingEvents } from "@/lib/db/conflicts";

const patchEventInputSchema = eventInputObjectSchema
  .partial()
  .extend({
    version: z.number().int(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return new Date(data.startTime) < new Date(data.endTime);
      }
      return true;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  );

type PatchEventInput = z.infer<typeof patchEventInputSchema>;

export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> => {
    const { id } = await params;
    const userId = await getCurrentUserId(request);

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        recurrenceRule: true,
      },
    });

    if (!event || event.userId !== userId) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "7.8.0",
      });
    }

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
    };

    return NextResponse.json(formattedEvent);
  }
);

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> => {
    const { id } = await params;
    
    return withValidation(patchEventInputSchema, async (req: Request, body: PatchEventInput): Promise<Response> => {
      const userId = await getCurrentUserId(req);

      const existing = await prisma.event.findUnique({
        where: { id },
        include: {
          recurrenceRule: true,
        },
      });

      if (!existing || existing.userId !== userId) {
        throw new Prisma.PrismaClientKnownRequestError("Record not found", {
          code: "P2025",
          clientVersion: "7.8.0",
        });
      }

      if (body.version !== undefined && existing.version !== body.version) {
        throw new VersionConflictError();
      }

      const finalStart = body.startTime ? new Date(body.startTime) : existing.startTime;
      const finalEnd = body.endTime ? new Date(body.endTime) : existing.endTime;

      const conflicts = await findConflictingEvents(
        userId,
        finalStart,
        finalEnd,
        id
      );

      let recurrenceRuleId: string | null | undefined = undefined;

      if (body.recurrenceRule === null) {
        if (existing.recurrenceRuleId) {
          await prisma.recurrenceRule.delete({
            where: { id: existing.recurrenceRuleId },
          });
        }
        recurrenceRuleId = null;
      } else if (body.recurrenceRule) {
        if (existing.recurrenceRuleId) {
          await prisma.recurrenceRule.update({
            where: { id: existing.recurrenceRuleId },
            data: {
              frequency: body.recurrenceRule.frequency,
              interval: body.recurrenceRule.interval,
              seriesStartDate: finalStart,
              seriesEndDate: body.recurrenceRule.seriesEndDate ? new Date(body.recurrenceRule.seriesEndDate) : null,
              byDay: body.recurrenceRule.byDay || Prisma.JsonNull,
            },
          });
        } else {
          const rec = await prisma.recurrenceRule.create({
            data: {
              frequency: body.recurrenceRule.frequency,
              interval: body.recurrenceRule.interval,
              seriesStartDate: finalStart,
              seriesEndDate: body.recurrenceRule.seriesEndDate ? new Date(body.recurrenceRule.seriesEndDate) : null,
              byDay: body.recurrenceRule.byDay || undefined,
            },
          });
          recurrenceRuleId = rec.id;
        }
      }

      const event = await prisma.event.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
          startTime: body.startTime ? new Date(body.startTime) : undefined,
          endTime: body.endTime ? new Date(body.endTime) : undefined,
          allDay: body.allDay,
          recurrenceRuleId: recurrenceRuleId !== undefined ? recurrenceRuleId : undefined,
          version: { increment: 1 },
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

      return NextResponse.json(formattedEvent);
    })(request);
  }
);

export const DELETE = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> => {
    const { id } = await params;
    const userId = await getCurrentUserId(request);

    const result = await prisma.event.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "7.8.0",
      });
    }

    return new Response(null, { status: 204 });
  }
);
