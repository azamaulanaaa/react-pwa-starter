import { Schema, Struct } from "effect";

import { createEventBus } from "@/worker/db/change-bus.ts";
import { createDatabase, createTableModule } from "@/worker/db/factory.ts";
import { createDbFs } from "@/worker/db/persistence.ts";
import { BaseSchema } from "@/worker/db/schema.ts";

const ItemSchema = BaseSchema.mapFields(
  Struct.assign(
    Schema.Struct({
      label: Schema.NonEmptyString,
      done: Schema.Boolean,
    }).fields,
  ),
);

export type Item = Schema.Schema.Type<typeof ItemSchema>;

export const TableItem = createTableModule({
  name: "item",
  schema: ItemSchema,
});

/**
 * Returns a database with the test table.
 * The helper gives the database tests a table without a domain table.
 */
export function createTestDatabase() {
  const events = createEventBus();
  const dbFs = createDbFs({ item: TableItem });
  dbFs.attach(events);

  return createDatabase(
    "main",
    { item: TableItem },
    {
      events,
      hydrate: dbFs.hydrate,
    },
  );
}
