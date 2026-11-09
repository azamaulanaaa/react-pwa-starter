import { describe, expect, it } from "vitest";

import {
  decodeDocumentV1,
  DocumentV1,
  encodeDocumentV1,
  MARKDOWN_MAX_BYTES,
} from "@/lib/markdown/index.ts";

const DOCUMENT = {
  schemaVersion: 1,
  markdownVersion: 1,
  markdown: "# Title\n\nText.\n",
} as const;

describe("document envelope", () => {
  it("decodes a valid document", () => {
    expect(decodeDocumentV1(DOCUMENT)).toEqual(DOCUMENT);
  });

  it("accepts empty Markdown", () => {
    expect(
      decodeDocumentV1({
        schemaVersion: 1,
        markdownVersion: 1,
        markdown: "",
      }),
    ).toEqual({
      schemaVersion: 1,
      markdownVersion: 1,
      markdown: "",
    });
  });

  it("encodes a valid document", () => {
    expect(encodeDocumentV1(DOCUMENT)).toEqual(DOCUMENT);
  });

  it("keeps the schema type and the encoded value the same", () => {
    const encoded = encodeDocumentV1(DOCUMENT);
    const decoded: DocumentV1 = decodeDocumentV1(encoded);

    expect(decoded).toEqual(DOCUMENT);
  });

  it.each([
    ["a new schema version", { ...DOCUMENT, schemaVersion: 2 }],
    ["a new Markdown version", { ...DOCUMENT, markdownVersion: 2 }],
    ["a missing Markdown field", { schemaVersion: 1, markdownVersion: 1 }],
    ["a non-string Markdown field", { ...DOCUMENT, markdown: 42 }],
  ])("rejects %s", (_label, input) => {
    expect(() => decodeDocumentV1(input)).toThrow();
  });

  it("rejects Markdown over 100 KB", () => {
    expect(() =>
      decodeDocumentV1({
        schemaVersion: 1,
        markdownVersion: 1,
        markdown: "a".repeat(MARKDOWN_MAX_BYTES + 1),
      }),
    ).toThrow(/too large/i);
  });

  it("accepts exactly 100 KB of Markdown", () => {
    expect(
      decodeDocumentV1({
        schemaVersion: 1,
        markdownVersion: 1,
        markdown: "a".repeat(MARKDOWN_MAX_BYTES),
      }).markdown,
    ).toHaveLength(MARKDOWN_MAX_BYTES);
  });
});
