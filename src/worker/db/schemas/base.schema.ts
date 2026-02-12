import { z } from "zod";

export const BaseSchema = z.object({
  version: z.number(),
  id: z.uuid().length(36),
  created_at: z.string().datetime(),
  modified_at: z.string().datetime(),
});
