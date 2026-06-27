import { z } from "zod";

export const recurrenceInputSchema = z
  .object({
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    interval: z.number().int().min(1).default(1),
    byDay: z
      .array(z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]))
      .nullable()
      .optional(),
    seriesEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format, expected YYYY-MM-DD" })
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.frequency !== "WEEKLY" && data.byDay && data.byDay.length > 0) {
        return false;
      }
      return true;
    },
    {
      message: "byDay is only allowed for WEEKLY frequency",
      path: ["byDay"],
    }
  );

export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;
