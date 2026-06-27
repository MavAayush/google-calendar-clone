import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling, VersionConflictError } from "@/middleware/errors";
import { withValidation } from "@/middleware/validate";
import { eventInputObjectSchema } from "@/lib/validation/event";
import { editScopeSchema } from "@/lib/validation/editScope";
import { getCurrentUserId } from "@/lib/auth";
import prisma from "@/lib/db/client";
import { Prisma, Event } from "@prisma/client";
import { findConflictingEvents } from "@/lib/db/conflicts";
import { toUTC } from "@/lib/date/toUTC";
import { toLocal } from "@/lib/date/toLocal";

const patchEventInputSchema = eventInputObjectSchema
  .partial()
  .extend({
    version: z.number().int(),
    editScope: editScopeSchema.optional(),
    instanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

function parseEventId(id: string): { anchorId: string; instanceDateStr: string | null } {
  let anchorId = id;
  let instanceDateStr: string | null = null;
  if (id.length > 10 && id.charAt(id.length - 11) === "-") {
    const potentialDate = id.slice(-10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(potentialDate)) {
      anchorId = id.slice(0, -11);
      instanceDateStr = potentialDate;
    }
  }
  return { anchorId, instanceDateStr };
}

export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> => {
    const { id: rawId } = await params;
    const { anchorId, instanceDateStr } = parseEventId(rawId);
    const userId = await getCurrentUserId(request);

    const event = await prisma.event.findUnique({
      where: { id: anchorId },
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

    let targetEvent: Event = event;
    if (event.recurrenceRuleId && instanceDateStr) {
      // If we are looking up a specific modified instance date that already exists
      const exception = await prisma.recurrenceException.findUnique({
        where: {
          recurrenceRuleId_instanceDate: {
            recurrenceRuleId: event.recurrenceRuleId,
            instanceDate: new Date(instanceDateStr),
          },
        },
        include: {
          overrideEvent: true,
        },
      });

      if (exception && exception.exceptionType === "MODIFIED" && exception.overrideEvent) {
        targetEvent = exception.overrideEvent;
      }
    }

    const formattedEvent = {
      id: rawId,
      title: targetEvent.title,
      description: targetEvent.description,
      startTime: targetEvent.startTime.toISOString(),
      endTime: targetEvent.endTime.toISOString(),
      allDay: targetEvent.allDay,
      isRecurring: !!event.recurrenceRule,
      recurrence: event.recurrenceRule ? {
        frequency: event.recurrenceRule.frequency,
        interval: event.recurrenceRule.interval,
        seriesEndDate: event.recurrenceRule.seriesEndDate
          ? event.recurrenceRule.seriesEndDate.toISOString().split("T")[0]
          : null,
        byDay: event.recurrenceRule.byDay,
      } : null,
      version: targetEvent.version,
    };

    return NextResponse.json(formattedEvent);
  }
);

export const PATCH = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> => {
    const { id: rawId } = await params;
    const { anchorId, instanceDateStr } = parseEventId(rawId);
    
    return withValidation(patchEventInputSchema, async (req: Request, body: PatchEventInput): Promise<Response> => {
      const userId = await getCurrentUserId(req);

      const existing = await prisma.event.findUnique({
        where: { id: anchorId },
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

      // Check if it is a recurring event series
      if (existing.recurrenceRuleId) {
        const editScope = body.editScope;
        const targetDateStr = body.instanceDate || instanceDateStr;

        if (!editScope) {
          return new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_ERROR",
                message: "editScope is required for recurring events",
                fields: { editScope: "editScope is required for recurring events" },
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (editScope === "THIS") {
          if (!targetDateStr) {
            return new Response(
              JSON.stringify({
                error: {
                  code: "VALIDATION_ERROR",
                  message: "instanceDate is required for THIS editScope",
                  fields: { instanceDate: "instanceDate is required for THIS editScope" },
                },
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const targetDate = new Date(targetDateStr);

          // Look up if an exception already exists for this rule and instance date
          const existingException = await prisma.recurrenceException.findUnique({
            where: {
              recurrenceRuleId_instanceDate: {
                recurrenceRuleId: existing.recurrenceRuleId,
                instanceDate: targetDate,
              },
            },
            include: {
              overrideEvent: true,
            },
          });

          // Compute final start and end times for conflict check and override creation
          let finalStart: Date;
          let finalEnd: Date;

          if (existingException && existingException.exceptionType === "MODIFIED" && existingException.overrideEvent) {
            // Validate version against override event
            if (body.version !== undefined && existingException.overrideEvent.version !== body.version) {
              throw new VersionConflictError();
            }
            finalStart = body.startTime ? new Date(body.startTime) : existingException.overrideEvent.startTime;
            finalEnd = body.endTime ? new Date(body.endTime) : existingException.overrideEvent.endTime;
          } else {
            // Validate version against anchor event
            if (body.version !== undefined && existing.version !== body.version) {
              throw new VersionConflictError();
            }

            // Construct default start/end times based on the occurrence date (targetDateStr)
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const timezone = user?.timezone || "UTC";
            const durationMs = existing.endTime.getTime() - existing.startTime.getTime();
            
            const localStartStr = toLocal(existing.startTime.toISOString(), timezone, existing.allDay);
            const timePart = localStartStr.split("T")[1];
            const defaultStartStr = `${targetDateStr}T${timePart}`;
            const defaultStartUTC = toUTC(defaultStartStr, timezone, existing.allDay);
            const defaultEndUTC = new Date(new Date(defaultStartUTC).getTime() + durationMs).toISOString();

            finalStart = body.startTime ? new Date(body.startTime) : new Date(defaultStartUTC);
            finalEnd = body.endTime ? new Date(body.endTime) : new Date(defaultEndUTC);
          }

          // Run conflict check (exclude the override event if it exists)
          const excludeId = (existingException && existingException.exceptionType === "MODIFIED")
            ? existingException.overrideEventId || undefined
            : undefined;

          const conflicts = await findConflictingEvents(
            userId,
            finalStart,
            finalEnd,
            excludeId
          );

          let updatedEvent: Event;

          if (existingException && existingException.exceptionType === "MODIFIED" && existingException.overrideEvent) {
            // Update existing override event
            updatedEvent = await prisma.event.update({
              where: { id: existingException.overrideEventId! },
              data: {
                title: body.title,
                description: body.description,
                startTime: body.startTime ? new Date(body.startTime) : undefined,
                endTime: body.endTime ? new Date(body.endTime) : undefined,
                allDay: body.allDay,
                version: { increment: 1 },
              },
            });
          } else {
            // Create a new override event
            const overrideEvent = await prisma.event.create({
              data: {
                userId,
                title: body.title !== undefined ? body.title : existing.title,
                description: body.description !== undefined ? body.description : existing.description,
                startTime: finalStart,
                endTime: finalEnd,
                allDay: body.allDay !== undefined ? body.allDay : existing.allDay,
                recurrenceRuleId: null,
                version: 1,
              },
            });

            // Add recurrence exception
            await prisma.recurrenceException.create({
              data: {
                recurrenceRuleId: existing.recurrenceRuleId,
                instanceDate: targetDate,
                exceptionType: "MODIFIED",
                overrideEventId: overrideEvent.id,
              },
            });

            updatedEvent = overrideEvent;
          }

          // Return the formatted response representing this occurrence
          const formattedEvent = {
            id: `${existing.id}-${targetDateStr}`, // Synthetic ID matching the expanded instance
            title: updatedEvent.title,
            description: updatedEvent.description,
            startTime: updatedEvent.startTime.toISOString(),
            endTime: updatedEvent.endTime.toISOString(),
            allDay: updatedEvent.allDay,
            isRecurring: true,
            recurrence: existing.recurrenceRule ? {
              frequency: existing.recurrenceRule.frequency,
              interval: existing.recurrenceRule.interval,
              seriesEndDate: existing.recurrenceRule.seriesEndDate
                ? existing.recurrenceRule.seriesEndDate.toISOString().split("T")[0]
                : null,
              byDay: existing.recurrenceRule.byDay,
            } : null,
            version: updatedEvent.version,
            conflicts,
          };

          return NextResponse.json(formattedEvent);
        } else {
          // THIS_AND_FOLLOWING or ALL (to be implemented in next phase)
          return new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_ERROR",
                message: "Edit scope not implemented in this phase",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // Non-recurring event: update directly
      if (body.version !== undefined && existing.version !== body.version) {
        throw new VersionConflictError();
      }

      const finalStart = body.startTime ? new Date(body.startTime) : existing.startTime;
      const finalEnd = body.endTime ? new Date(body.endTime) : existing.endTime;

      const conflicts = await findConflictingEvents(
        userId,
        finalStart,
        finalEnd,
        anchorId
      );

      const event = await prisma.event.update({
        where: { id: anchorId },
        data: {
          title: body.title,
          description: body.description,
          startTime: body.startTime ? new Date(body.startTime) : undefined,
          endTime: body.endTime ? new Date(body.endTime) : undefined,
          allDay: body.allDay,
          version: { increment: 1 },
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
        conflicts,
      };

      return NextResponse.json(formattedEvent);
    })(request);
  }
);

export const DELETE = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> => {
    const { id: rawId } = await params;
    const { anchorId, instanceDateStr } = parseEventId(rawId);
    const userId = await getCurrentUserId(request);

    const existing = await prisma.event.findUnique({
      where: { id: anchorId },
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

    if (existing.recurrenceRuleId) {
      const url = new URL(request.url);
      const editScope = url.searchParams.get("editScope");
      const targetDateStr = url.searchParams.get("instanceDate") || instanceDateStr;

      if (!editScope) {
        return new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "editScope is required for deleting recurring event instances",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (editScope === "THIS") {
        if (!targetDateStr) {
          return new Response(
            JSON.stringify({
              error: {
                code: "VALIDATION_ERROR",
                message: "instanceDate is required for THIS editScope",
              },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const targetDate = new Date(targetDateStr);

        const existingException = await prisma.recurrenceException.findUnique({
          where: {
            recurrenceRuleId_instanceDate: {
              recurrenceRuleId: existing.recurrenceRuleId,
              instanceDate: targetDate,
            },
          },
        });

        if (existingException) {
          if (existingException.exceptionType === "MODIFIED") {
            // Delete override event if it exists
            if (existingException.overrideEventId) {
              await prisma.event.delete({
                where: { id: existingException.overrideEventId },
              });
            }
            // Update exception to CANCELLED
            await prisma.recurrenceException.update({
              where: { id: existingException.id },
              data: {
                exceptionType: "CANCELLED",
                overrideEventId: null,
              },
            });
          }
          // If already CANCELLED, do nothing
        } else {
          // Create CANCELLED exception
          await prisma.recurrenceException.create({
            data: {
              recurrenceRuleId: existing.recurrenceRuleId,
              instanceDate: targetDate,
              exceptionType: "CANCELLED",
            },
          });
        }

        return new Response(null, { status: 204 });
      } else {
        // Other scopes not supported in this phase
        return new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Delete scope not implemented in this phase",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Non-recurring event: delete directly
    await prisma.event.delete({
      where: { id: anchorId },
    });

    return new Response(null, { status: 204 });
  }
);

