import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { getUnsupportedFeatures } from "@/components/editor/support.ts";

const FIXTURE_DIRECTORY = new URL(
  "../../lib/markdown/__fixtures__/",
  import.meta.url,
);

/** Reads one Markdown fixture. */
function readFixture(name: string): string {
  return readFileSync(new URL(name, FIXTURE_DIRECTORY), "utf8");
}

describe("getUnsupportedFeatures", () => {
  it("reports a table", () => {
    expect(getUnsupportedFeatures(readFixture("table.md"))).toEqual(["table"]);
  });

  it("reports an image", () => {
    expect(getUnsupportedFeatures(readFixture("links-images.md"))).toEqual([
      "image",
    ]);
  });

  it("accepts a basic document", () => {
    expect(getUnsupportedFeatures(readFixture("basic.md"))).toEqual([]);
  });

  it("reports raw HTML", () => {
    expect(getUnsupportedFeatures("# Title\n\n<div>Hello</div>\n")).toEqual([
      "html",
    ]);
  });

  it("reports a footnote", () => {
    expect(
      getUnsupportedFeatures(
        "A note with a footnote.[^1]\n\n[^1]: The note.\n",
      ),
    ).toEqual(["footnote"]);
  });

  it("accepts an empty document", () => {
    expect(getUnsupportedFeatures("")).toEqual([]);
  });
});
