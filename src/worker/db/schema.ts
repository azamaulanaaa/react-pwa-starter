import { Schema } from "effect";

export const IdSchema = Schema.NonEmptyString;
export type Id = Schema.Schema.Type<typeof IdSchema>;

export const BaseSchema = Schema.Struct({
  id: IdSchema,
  created_at: Schema.DateFromString,
  modified_at: Schema.DateFromString,
});
export type Base = Schema.Schema.Type<typeof BaseSchema>;
