import { Schema, Struct } from "effect";
import { createTableModule } from "@/worker/db/factory.ts";
import { BaseSchema } from "@/worker/db/schema.ts";

const TaskSchema = BaseSchema.mapFields(
  Struct.assign(Schema.Struct({
    description: Schema.NonEmptyString,
    is_done: Schema.Boolean,
  }).fields),
);
export type Task = Schema.Schema.Type<typeof TaskSchema>;

export const TableTask = createTableModule({
  name: "task",
  schema: TaskSchema,
});
