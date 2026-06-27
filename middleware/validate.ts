import { z } from "zod";

export const withValidation = <T, A extends unknown[]>(
  schema: z.ZodSchema<T>,
  handler: (request: Request, body: T, ...args: A) => Promise<Response>
) => {
  return async (request: Request, ...args: A): Promise<Response> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: [],
          message: "Invalid or empty JSON body",
        },
      ]);
    }

    const parsed = schema.parse(body);
    return handler(request, parsed, ...args);
  };
};
