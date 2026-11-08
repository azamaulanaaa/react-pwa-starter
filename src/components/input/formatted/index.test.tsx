// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InputFormatted } from "@/components/input/formatted/index.tsx";

describe("InputFormatted", () => {
  it("reports each keystroke and keeps the typed text", () => {
    const onChange = vi.fn();

    render(<InputFormatted onChange={onChange} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.change(input, { target: { value: "123" } });

    expect(input.value).toBe("123");
    expect(onChange.mock.calls).toEqual([["1"], ["12"], ["123"]]);
  });

  it("normalizes the text on blur", () => {
    const onChange = vi.fn();

    render(
      <InputFormatted
        formatter={(value: string) => value.trim()}
        onChange={onChange}
        parser={(value) => value.trim()}
      />,
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "  42  " } });
    fireEvent.blur(input);

    expect(input.value).toBe("42");
    expect(onChange).toHaveBeenLastCalledWith("42");
  });
});
