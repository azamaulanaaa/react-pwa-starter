import { Schema, Struct } from "effect";

import { createTableModule } from "@/worker/db/factory.ts";
import { BaseSchema } from "@/worker/db/schema.ts";

const TaskSchema = BaseSchema.mapFields(
  Struct.assign(
    Schema.Struct({
      description: Schema.NonEmptyString,
      is_done: Schema.Boolean,
    }).fields,
  ),
);

export type Task = Schema.Schema.Type<typeof TaskSchema>;

/**
 * Defines the task table for the example.
 * The starter does not register this table in the worker database.
 */
export const TableTask = createTableModule({
  name: "task",
  schema: TaskSchema,
});

export type TaskTableApi = ReturnType<typeof TableTask.api>;
