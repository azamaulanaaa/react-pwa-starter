// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  type NestedRecord,
  TranslationProvider,
} from "@/components/context/translation.tsx";
import { MarkdownEditor } from "@/components/editor/markdown-editor.tsx";

import enDictionary from "~/public/locales/en-US.json" with { type: "json" };

const TABLE = ["| Name | Value |", "| ---- | ----- |", "| A    | 1     |"].join(
  "\n",
);

/** Adds the translation context to one test tree. */
function Providers({ children }: { children: ReactNode }) {
  const dictionary = enDictionary as NestedRecord;

  return (
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      {children}
    </TranslationProvider>
  );
}

/**
 * Runs axe on one element.
 * The jsdom test environment has no layout engine, so it cannot measure the
 * color-contrast rule. The test disables that rule. A separate check measures
 * the declared token pairs.
 */
async function runAxe(container: HTMLElement): Promise<axe.Result[]> {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
    },
  });

  return results.violations;
}

describe("Markdown editor accessibility audit", () => {
  it("has no axe violations in the editor and toolbar", async () => {
    const { container } = render(
      <Providers>
        <MarkdownEditor
          ariaLabel="Note body"
          onChange={vi.fn()}
          value={"Hello **world**.\n"}
        />
      </Providers>,
    );

    expect(screen.getByRole("textbox", { name: "Note body" })).toBeDefined();
    expect(
      screen.getByRole("toolbar", { name: "Text formatting" }),
    ).toBeDefined();

    const violations = await runAxe(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });

  it("has no axe violations in the raw Markdown fallback", async () => {
    const { container } = render(
      <Providers>
        <MarkdownEditor
          ariaLabel="Note body"
          onChange={vi.fn()}
          value={TABLE}
        />
      </Providers>,
    );

    expect(
      screen.getByRole("textbox", { name: "Markdown source" }),
    ).toBeDefined();

    const violations = await runAxe(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
