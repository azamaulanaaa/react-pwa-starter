import { Schema } from "effect";

/**
 * Returns the announcement form schema.
 * The schema requires a title and a message.
 */
export const useFormAnnouncementSchema = () => {
  return Schema.Struct({
    title: Schema.String.pipe(
      Schema.check(Schema.makeFilter((value) => value.trim().length > 0)),
    ),
    body: Schema.String.pipe(
      Schema.check(Schema.makeFilter((value) => value.trim().length > 0)),
    ),
    variant: Schema.Literals(["info", "success", "warning", "error"]),
    preferredPresentation: Schema.Literals(["dialog", "banner"]),
  });
};

export type FormAnnouncementValue = Schema.Schema.Type<
  ReturnType<typeof useFormAnnouncementSchema>
>;
