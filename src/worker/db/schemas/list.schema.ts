import { z } from "zod";

import { RxCollectionDefinition } from "@/worker/db/lib/builder.ts";

export const ListSchemaV0 = z.object({
  value: z.string(),
});

export const ListSchemaV1 = z.object({
  content: z.string(),
});

export const ListCollectionBuilder = RxCollectionDefinition.create("list")
  .initial(ListSchemaV0)
  .addStep(ListSchemaV1, (prev) => ({
    content: prev.value,
  }));
