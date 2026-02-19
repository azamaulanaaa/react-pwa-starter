import { MigrationStrategies, RxDatabase, RxJsonSchema } from "rxdb";
import { z } from "zod";

// Get the last index as a string (e.g. "1" instead of 1) so it matches our keys
type LastIndexString<T extends readonly unknown[]> = T extends
  readonly [...infer Rest, unknown] ? `${Rest["length"]}`
  : never;

// Build a strict ZodRawShape. Keys are strictly present.
// If it's the last index, use the schema as-is. Otherwise, wrap it in z.ZodOptional.
type VersionedPlayloadShape<Schemas extends readonly z.ZodObject[]> = {
  [K in keyof Schemas as K extends `${number}` ? `v${K}` : never]:
    Schemas[K] extends z.ZodTypeAny
      ? K extends LastIndexString<Schemas> ? Schemas[K]
      : z.ZodOptional<Schemas[K]>
      : never;
};

export const BaseSchema = z.object({
  id: z.uuid().length(36),
  created_at: z.iso.datetime(),
  modified_at: z.iso.datetime(),
  payload: z.object(),
});

export function composeFullZodSchema<
  const Schemas extends readonly z.ZodObject[],
>(
  payloadSchemas: Schemas,
) {
  const modifiedShape: Record<string, z.ZodTypeAny> = {};

  payloadSchemas.forEach((s, i) => {
    const key = `v${i}`;
    const isLast = i === payloadSchemas.length - 1;
    modifiedShape[key] = isLast ? s : s.optional();
  });

  return BaseSchema.extend({
    payload: z.object(
      modifiedShape as unknown as VersionedPlayloadShape<Schemas>,
    ),
  });
}

export function composeLatestZodSchema<
  const Schemas extends readonly z.ZodObject[],
>(
  payloadSchema: Schemas,
) {
  const keys = Object.keys(payloadSchema).map(Number).sort((a, b) => a - b);
  const latestVersion = keys[keys.length - 1];

  return BaseSchema.extend({
    payload: z.object({
      [`v${latestVersion}`]: payloadSchema[latestVersion],
    }),
  });
}

export function transformToRxJsonSchema<
  const Schemas extends readonly z.ZodObject[],
>(
  title: string,
  payloadRecord: Schemas,
) {
  const schema = composeFullZodSchema(payloadRecord);
  type Doc = z.infer<typeof schema>;

  const keys = Object.keys(payloadRecord).map(Number).sort((a, b) => a - b);
  const latestVersion = keys[keys.length - 1];

  const jsonSchema = z.toJSONSchema(schema, { target: "draft-07" });

  return {
    title,
    version: latestVersion,
    primaryKey: "id",
    type: "object",
    ...jsonSchema,
  } as unknown as RxJsonSchema<Doc>;
}

type MigrationFn<TPrev, TNext> = (oldData: TPrev) => TNext;

export class RxCollectionDefinition<
  C extends z.ZodObject<any> = any,
  AS extends readonly z.ZodObject[] = readonly [],
> {
  constructor(
    public readonly title: string,
    public readonly schemas: AS = [] as unknown as AS,
    public readonly migrations: MigrationFn<any, any>[] = [],
  ) {}

  static create(title: string) {
    return new RxCollectionDefinition(title);
  }

  initial<S extends z.ZodObject>(schema: S) {
    return new RxCollectionDefinition<S, readonly [S]>(
      this.title,
      [schema] as const,
      [],
    );
  }

  addStep<S extends z.ZodObject>(
    schema: S,
    migrate: MigrationFn<z.infer<C>, z.infer<S>>,
  ) {
    return new RxCollectionDefinition<S, readonly [...AS, S]>(
      this.title,
      [...this.schemas, schema] as const,
      [...this.migrations, migrate],
    );
  }

  schema() {
    return composeFullZodSchema(this.schemas);
  }
}

export function assembleCollectionConfig<
  C extends z.ZodObject<any>,
  AS extends readonly z.ZodObject[],
>(definition: RxCollectionDefinition<C, AS>) {
  const rxSchema = transformToRxJsonSchema(
    definition.title,
    definition.schemas,
  );

  const migrationStrategies: MigrationStrategies = {};

  for (let index = 1; index < definition.schemas.length; index++) {
    const prevSchema = definition.schemas[index - 1];
    const migrateFn = definition.migrations[index - 1];

    migrationStrategies[index] = (oldDoc: any) => {
      const prevData = prevSchema.parse(oldDoc.payload[`v${index - 1}`]);

      oldDoc.payload[`v${index}`] = migrateFn(prevData);

      return oldDoc;
    };
  }

  return {
    title: definition.title,
    schema: rxSchema,
    migrationStrategies,
  };
}

export async function initializeCollection<
  C extends z.ZodObject<any>,
  AS extends readonly z.ZodObject[],
>(
  definition: RxCollectionDefinition<C, AS>,
  db: RxDatabase,
) {
  const config = assembleCollectionConfig(definition);
  const latestSchema = composeLatestZodSchema(definition.schemas);

  const collections = await db.addCollections({
    [definition.title]: {
      schema: config.schema,
      migrationStrategies: config.migrationStrategies,
    },
  });

  const collection = collections[definition.title];

  collection.preInsert(latestSchema.parse, false);
  collection.preSave(latestSchema.parse, false);

  return collection;
}
