import { Schema } from "effect";

import { MARKDOWN_MAX_BYTES } from "./dialect.ts";

/**
 * Defines the stored document envelope.
 * The schema version and the Markdown version are both 1.
 */
export const DocumentV1 = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  markdownVersion: Schema.Literal(1),
  markdown: Schema.String.check(
    Schema.makeFilter((markdown) => {
      if (new TextEncoder().encode(markdown).byteLength > MARKDOWN_MAX_BYTES) {
        return "The document is too large. Shorten the Markdown to 100 KB or less.";
      }

      return;
    }),
  ),
});

/** Defines one stored document. */
export type DocumentV1 = Schema.Schema.Type<typeof DocumentV1>;

/**
 * Decodes one stored document.
 * The function throws when the input does not match the schema.
 */
export function decodeDocumentV1(input: unknown): DocumentV1 {
  return Schema.decodeUnknownSync(DocumentV1)(input);
}

/**
 * Encodes one stored document for storage.
 * The function throws when the value does not match the schema.
 */
export function encodeDocumentV1(document: DocumentV1): DocumentV1 {
  return Schema.encodeSync(DocumentV1)(document);
}
