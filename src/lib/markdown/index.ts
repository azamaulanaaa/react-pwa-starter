export {
  CANONICAL_STRINGIFY_OPTIONS,
  canonicalize,
  hashCanonical,
  MARKDOWN_MAX_BYTES,
  MARKDOWN_MAX_LIST_DEPTH,
  MARKDOWN_MAX_TABLE_COLUMNS,
  MARKDOWN_MAX_TABLE_ROWS,
  normalize,
  parse,
  stringify,
  validate,
  type MarkdownErrorCode,
  type MarkdownValidation,
} from "./dialect.ts";
export { decodeDocumentV1, DocumentV1, encodeDocumentV1 } from "./envelope.ts";
export type { DocumentV1 as DocumentV1Type } from "./envelope.ts";
