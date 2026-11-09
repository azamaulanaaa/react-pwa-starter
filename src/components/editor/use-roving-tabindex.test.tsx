// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRovingTabindex } from "@/components/editor/use-roving-tabindex.ts";

/** Shows three controls that use one roving tab order. */
function TestToolbar({ disableSecond = false }: { disableSecond?: boolean }) {
  const roving = useRovingTabindex();

  return (
    <div
      aria-label="Test toolbar"
      onKeyDown={roving.onKeyDown}
      ref={roving.containerRef}
      role="toolbar"
    >
      <button {...roving.getItemProps(0)} type="button">
        First
      </button>
      <button
        disabled={disableSecond}
        type="button"
        {...roving.getItemProps(1)}
      >
        Second
      </button>
      <button type="button" {...roving.getItemProps(2)}>
        Third
      </button>
    </div>
  );
}

describe("useRovingTabindex", () => {
  it("gives the toolbar one tab stop", () => {
    render(<TestToolbar />);
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });

    expect(first.getAttribute("tabindex")).toBe("0");
    expect(second.getAttribute("tabindex")).toBe("-1");
  });

  it("moves focus with ArrowRight and ArrowLeft", () => {
    render(<TestToolbar />);
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    const third = screen.getByRole("button", { name: "Third" });

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("tabindex")).toBe("0");
    expect(first.getAttribute("tabindex")).toBe("-1");

    fireEvent.keyDown(second, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(third);
  });

  it("moves focus to the first and last control with Home and End", () => {
    render(<TestToolbar />);
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    const third = screen.getByRole("button", { name: "Third" });

    second.focus();
    fireEvent.keyDown(second, { key: "Home" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "End" });
    expect(document.activeElement).toBe(third);
  });

  it("skips a disabled control", () => {
    render(<TestToolbar disableSecond />);
    const first = screen.getByRole("button", { name: "First" });
    const third = screen.getByRole("button", { name: "Third" });

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(third);
  });

  it("keeps a tab stop when the active control becomes disabled", async () => {
    const { rerender } = render(<TestToolbar />);
    const second = screen.getByRole("button", { name: "Second" });

    second.focus();
    await act(async () => {
      rerender(<TestToolbar disableSecond />);
    });

    await waitFor(() => {
      expect(second.getAttribute("tabindex")).toBe("-1");
      expect(
        screen.getByRole("button", { name: "First" }).getAttribute("tabindex"),
      ).toBe("0");
    });

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "First" }),
    );
  });
});
