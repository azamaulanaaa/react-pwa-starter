import { Schema } from "effect";

import { validate } from "@/lib/markdown/index.ts";

/**
 * Returns the announcement form schema.
 * The schema requires a title and a message.
 * The message must use the md-lite/1 Markdown dialect.
 * The function uses markdownInvalidMessage for an invalid message.
 */
export const useFormAnnouncementSchema = (markdownInvalidMessage: string) => {
  const markdownFilter = Schema.makeFilter(
    (value: string) => {
      if (value.trim().length === 0) {
        return;
      }

      const result = validate(value);

      return result.ok ? undefined : result.code;
    },
    { message: markdownInvalidMessage },
  );

  return Schema.Struct({
    title: Schema.String.pipe(
      Schema.check(Schema.makeFilter((value) => value.trim().length > 0)),
    ),
    body: Schema.String.pipe(
      Schema.check(
        Schema.makeFilter((value) => value.trim().length > 0),
        markdownFilter,
      ),
    ),
    variant: Schema.Literals(["info", "success", "warning", "error"]),
    preferredPresentation: Schema.Literals(["dialog", "banner"]),
  });
};

export type FormAnnouncementValue = Schema.Schema.Type<
  ReturnType<typeof useFormAnnouncementSchema>
>;
