import { NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/middleware/errors";
import { getCurrentUserId } from "@/lib/auth";
import { findConflictingEvents } from "@/lib/db/conflicts";

const getConflictsQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export const GET = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    const parsedQuery = getConflictsQuerySchema.parse({
      start: startParam,
      end: endParam,
    });

    const { start, end } = parsedQuery;
    const userId = await getCurrentUserId(request);

    const conflicts = await findConflictingEvents(
      userId,
      new Date(start),
      new Date(end),
      id
    );

    return NextResponse.json({ conflicts });
  }
);
