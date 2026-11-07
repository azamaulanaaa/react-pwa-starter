// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mountLoaded: false,
  authLoaded: false,
}));

vi.mock("./main/mount.tsx", () => {
  mocks.mountLoaded = true;

  return {
    default: ({ children }: { children: ReactNode }) => (
      <div data-testid="rust-api-adapter">{children}</div>
    ),
  };
});

vi.mock("./main/auth-ui.tsx", () => {
  mocks.authLoaded = true;

  return {
    RustApiAuthCard: () => <div data-testid="rust-api-auth-card" />,
  };
});

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  mocks.mountLoaded = false;
  mocks.authLoaded = false;
});

describe("RustApiMount", () => {
  it("renders the children without loading the adapter or sending a request", async () => {
    vi.stubEnv("VITE_RUST_API_ENABLED", "false");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { RustApiMount } = await import("@/rust-api/optional.tsx");

    render(
      <RustApiMount>
        <span>child content</span>
      </RustApiMount>,
    );

    expect(screen.getByText("child content")).toBeDefined();
    expect(mocks.mountLoaded).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads the adapter and wraps the children when the switch is on", async () => {
    vi.stubEnv("VITE_RUST_API_ENABLED", "true");
    const { RustApiMount } = await import("@/rust-api/optional.tsx");

    render(
      <RustApiMount>
        <span>child content</span>
      </RustApiMount>,
    );

    expect(await screen.findByTestId("rust-api-adapter")).toBeDefined();
    expect(screen.getByText("child content")).toBeDefined();
    expect(mocks.mountLoaded).toBe(true);
  });
});

describe("RustApiLoginPanel", () => {
  it("renders nothing without loading the authentication card", async () => {
    vi.stubEnv("VITE_RUST_API_ENABLED", "false");
    const { RustApiLoginPanel } = await import("@/rust-api/optional.tsx");
    const { container } = render(<RustApiLoginPanel />);

    expect(container.textContent).toBe("");
    expect(mocks.authLoaded).toBe(false);
  });

  it("loads the authentication card when the switch is on", async () => {
    vi.stubEnv("VITE_RUST_API_ENABLED", "true");
    const { RustApiLoginPanel } = await import("@/rust-api/optional.tsx");

    render(<RustApiLoginPanel />);

    expect(await screen.findByTestId("rust-api-auth-card")).toBeDefined();
    expect(mocks.authLoaded).toBe(true);
  });
});
