import { RxJsonSchema } from "rxdb";
import { z } from "zod";
import * as z4 from "zod/v4/core";

import { BaseSchema } from "../schemas/base.schema.ts";

export function createRxSchema<
  S extends Array<z4.$ZodObject>,
  T extends z4.$ZodDiscriminatedUnion<S, "version">,
>(
  title: string,
  zodSchema: T,
) {
  let schema = z.object({});

  for (const option of zodSchema._zod.def.options) {
    schema = schema.safeExtend(option._zod.def.shape);
  }

  const flatZodSchema = schema.partial().safeExtend(BaseSchema.shape);

  const jsonSchema = z.toJSONSchema(flatZodSchema, { target: "jsonSchema7" });

  return {
    title,
    version: 0,
    ...jsonSchema,
    primaryKey: "id",
  } as unknown as RxJsonSchema<z.infer<T>>;
}
