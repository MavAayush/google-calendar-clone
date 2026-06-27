import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class VersionConflictError extends Error {
  code = "VERSION_CONFLICT";
  status = 409;
  constructor(message = "Version conflict occurred") {
    super(message);
    this.name = "VersionConflictError";
  }
}

export const withErrorHandling = (
  handler: (request: Request, ...args: unknown[]) => Promise<Response>
) => {
  return async (request: Request, ...args: unknown[]): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of error.issues) {
          const path = issue.path.join(".");
          fields[path] = issue.message;
        }
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              fields,
            },
          },
          { status: 400 }
        );
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return NextResponse.json(
            {
              error: {
                code: "NOT_FOUND",
                message: "Record not found",
                fields: null,
              },
            },
            { status: 404 }
          );
        }
      }

      if (error instanceof VersionConflictError) {
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
              fields: null,
            },
          },
          { status: error.status }
        );
      }

      const err = error as Error & { status?: number; code?: string; fields?: Record<string, string> | null };
      const status = err.status || 500;
      const code = err.code || "INTERNAL_ERROR";
      const message = err.status ? err.message : "An unexpected error occurred";

      return NextResponse.json(
        {
          error: {
            code,
            message,
            fields: err.fields || null,
          },
        },
        { status }
      );
    }
  };
};
