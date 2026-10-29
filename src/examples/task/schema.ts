import { Schema } from "effect";

/**
 * Returns the task form schema.
 * The schema requires a non-empty task description.
 */
export const useFormTaskSchema = () => {
  return Schema.Struct({
    task: Schema.String.pipe(
      Schema.check(Schema.makeFilter((value) => value.length > 0)),
    ),
  });
};

export type FormTaskValue = Schema.Schema.Type<
  ReturnType<typeof useFormTaskSchema>
>;
