import { z } from "zod";
import { recurrenceInputSchema } from "./recurrence";

export const eventInputObjectSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  allDay: z.boolean().default(false),
  recurrenceRule: recurrenceInputSchema.nullable().optional(),
});

export const eventInputSchema = eventInputObjectSchema.refine(
  (data) => new Date(data.startTime) < new Date(data.endTime),
  {
    message: "End time must be after start time",
    path: ["endTime"],
  }
);

export type EventInput = z.infer<typeof eventInputSchema>;
