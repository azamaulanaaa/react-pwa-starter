import { z } from "zod";

import { BaseSchema } from "./base.schema.ts";

export const ListSchemaV0 = BaseSchema.extend({
  version: z.literal(0),
  value: z.string(),
});

export const ListSchemaV1 = BaseSchema.extend({
  version: z.literal(1),
  content: z.string(),
});

export const ListSchemaLatest = ListSchemaV1;

export const ListSchema = z.discriminatedUnion("version", [
  ListSchemaV0,
  ListSchemaV1,
]);

export const ListMigrationSchema = z.discriminatedUnion("version", [
  ListSchemaV0.transform((data) => ({
    ...data,
    version: 1 as const,
    content: data.value,
  })),
]);
