import { MigrationStrategies, RxJsonSchema } from "rxdb";
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
  let latestVersion = 0;

  for (const option of zodSchema._zod.def.options) {
    const shape = option._zod.def.shape;

    schema = schema.safeExtend(shape);

    // Get version literal values that should be a number
    const version = (shape.version as z4.$ZodLiteral<any>)._zod.def.values[0];
    latestVersion = Math.max(latestVersion, version);
  }

  const flatZodSchema = schema.partial().safeExtend(BaseSchema.shape);

  const jsonSchema = z.toJSONSchema(flatZodSchema, { target: "jsonSchema7" });

  return {
    title,
    version: latestVersion,
    ...jsonSchema,
    primaryKey: "id",
  } as unknown as RxJsonSchema<z.infer<T>>;
}

export function createRxMigration<
  S extends Array<z4.$ZodObject>,
  T extends z4.$ZodDiscriminatedUnion<S, "version">,
>(zodSchema: T): MigrationStrategies {
  const strategies: MigrationStrategies = {};

  // 1.  maximum version version literals defined in your Discriminated Union
  const maxVersion = Math.max(...zodSchema._zod.def.options
    .map((option: any) => option.shape.version._def.values[0]));

  for (let v = 1; v <= maxVersion; v++) {
    /**
     * We return the doc as-is.
     * Your `addZodHooks` will detect the old version later
     * and set the `stagedMigration` for the user to confirm.
     */
    strategies[v] = (oldDoc) => {
      // We don't transform here to keep your "User Confirmation" flow intact.
      return oldDoc;
    };
  }

  return strategies;
}
