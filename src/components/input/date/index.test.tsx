// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TranslationProvider } from "@/components/context/translation.tsx";
import { InputDate } from "@/components/input/date/index.tsx";

const DICTIONARY = {
  input_date_label: "Date",
  input_date_placeholder: "YYYY-MM-DD",
  input_date_toggle: "Toggle calendar",
};

function renderDate(props: Parameters<typeof InputDate>[0] = {}) {
  return render(
    <TranslationProvider dictionary={DICTIONARY}>
      <InputDate {...props} />
    </TranslationProvider>,
  );
}

describe("InputDate", () => {
  it("shows the invalid state and the error message", () => {
    renderDate({ error: "Select a valid date.", invalid: true });

    const input = screen.getByLabelText("Date") as HTMLInputElement;
    const error = screen.getByText("Select a valid date.");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("hides the calendar trigger when read-only", () => {
    renderDate({ readOnly: true });

    expect(
      screen.queryByRole("button", { name: "Toggle calendar" }),
    ).toBeNull();
  });

  it("shows the calendar trigger by default", () => {
    renderDate();

    expect(
      screen.getByRole("button", { name: "Toggle calendar" }),
    ).toBeDefined();
  });
});
