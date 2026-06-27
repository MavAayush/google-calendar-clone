import { z } from "zod";

export const editScopeSchema = z.enum(["THIS", "THIS_AND_FOLLOWING", "ALL"]);

export type EditScope = z.infer<typeof editScopeSchema>;
