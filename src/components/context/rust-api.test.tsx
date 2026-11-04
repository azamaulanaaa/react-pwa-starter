// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RustApiSessionBoundary,
  useRustApiBackend,
} from "@/components/context/rust-api.tsx";
import { SessionProvider, useSession } from "@/components/context/session.tsx";
import {
  createRustApiBackendIfEnabled,
  type RustApiBackend,
} from "@/integrations/rust-api/backend.ts";
import { createMemoryTokenStore } from "@/integrations/rust-api/client.ts";

vi.mock("@/components/context/session.tsx", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/context/session.tsx")>();

  return {
    ...actual,
    SessionProvider: vi.fn(actual.SessionProvider),
  };
});

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function SessionProbe() {
  const { session, status } = useSession();

  return (
    <span>
      {status}:{session?.user.id ?? "none"}
    </span>
  );
}

/** Defines the props for the backend probe. */
interface BackendProbeProps {
  onChange: (backend: RustApiBackend | null) => void;
}

function BackendProbe({ onChange }: BackendProbeProps) {
  const backend = useRustApiBackend();
  onChange(backend);

  return (
    <span>{backend === null ? "no backend" : backend.client.baseUrl}</span>
  );
}

describe("RustApiSessionBoundary", () => {
  beforeEach(() => {
    vi.mocked(SessionProvider).mockClear();
  });

  it("does not mount the session provider when the switch is off", () => {
    const fakeFetch = vi.fn(async () => jsonResponse({ ready: true }));
    const backend = createRustApiBackendIfEnabled({
      env: {},
      fetch: fakeFetch,
    });
    const onBackend = vi.fn();

    render(
      <RustApiSessionBoundary backend={backend}>
        <BackendProbe onChange={onBackend} />
      </RustApiSessionBoundary>,
    );

    expect(onBackend).toHaveBeenCalledWith(null);
    expect(screen.getByText("no backend")).toBeDefined();
    expect(SessionProvider).not.toHaveBeenCalled();
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("exposes the shared backend through the context", async () => {
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          sub: "user-1",
          iss: "issuer",
          aud: ["app"],
          exp: Math.floor(Date.now() / 1000) + 3_600,
        }),
    );
    const backend = createRustApiBackendIfEnabled({
      env: {
        VITE_RUST_API_ENABLED: "true",
        VITE_RUST_API_BASE_URL: "https://api.test",
      },
      fetch: fakeFetch,
      tokens: createMemoryTokenStore(),
    });

    if (backend === null) throw new Error("The rust-api backend is off.");

    const onBackend = vi.fn();

    render(
      <RustApiSessionBoundary backend={backend}>
        <BackendProbe onChange={onBackend} />
      </RustApiSessionBoundary>,
    );

    await waitFor(() => expect(fakeFetch).toHaveBeenCalled());
    expect(screen.getByText("https://api.test")).toBeDefined();

    const value = onBackend.mock.calls.at(-1)?.[0];

    expect(value).toBe(backend);
    expect(value?.replica).toBe(backend.replica);
    expect(value?.files).toBe(backend.files);
  });

  it("mounts the session provider when the switch is on", async () => {
    const fakeFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          sub: "user-1",
          iss: "issuer",
          aud: ["app"],
          exp: Math.floor(Date.now() / 1000) + 3_600,
        }),
    );
    const backend = createRustApiBackendIfEnabled({
      env: {
        VITE_RUST_API_ENABLED: "true",
        VITE_RUST_API_BASE_URL: "https://api.test",
      },
      fetch: fakeFetch,
      tokens: createMemoryTokenStore(),
    });

    if (backend === null) throw new Error("The rust-api backend is off.");

    render(
      <RustApiSessionBoundary backend={backend}>
        <SessionProbe />
      </RustApiSessionBoundary>,
    );

    expect(await screen.findByText("authenticated:user-1")).toBeDefined();
    expect(SessionProvider).toHaveBeenCalled();
    expect(fakeFetch).toHaveBeenCalledWith(
      "https://api.test/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
