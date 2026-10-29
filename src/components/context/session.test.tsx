// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  RequireSession,
  SessionProvider,
  useSession,
} from "@/components/context/session.tsx";
import type {
  LoginOptions,
  Session,
  SessionProvider as SessionProviderContract,
} from "@/lib/auth/types.ts";

const ALICE: Session = {
  user: { id: "u1", name: "Alice" },
  expiresAt: 4_102_444_800_000,
};

const BOB: Session = {
  user: { id: "u2", name: "Bob" },
  expiresAt: 4_102_444_800_000,
};

const EXPIRED: Session = {
  user: { id: "u3", name: "Expired" },
  expiresAt: 1,
};

function createFakeProvider(initial: Session | null) {
  let current = initial;

  const provider = {
    getSession: vi.fn(async (): Promise<Session | null> => current),
    login: vi.fn(async (_options?: LoginOptions): Promise<void> => {}),
    logout: vi.fn(async (): Promise<void> => {
      current = null;
    }),
    refresh: vi.fn(async (): Promise<Session | null> => current),
  } satisfies SessionProviderContract;

  return {
    provider,
    setSession(next: Session | null) {
      current = next;
    },
  };
}

function SessionProbe() {
  const { session, status } = useSession();

  return (
    <div>
      <span>{status}</span>
      <span>{session?.user.name ?? "none"}</span>
    </div>
  );
}

function SessionControls() {
  const { refresh, logout } = useSession();

  return (
    <div>
      <button type="button" onClick={() => void refresh()}>
        Refresh
      </button>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
    </div>
  );
}

type RenderSessionOptions = {
  fake: ReturnType<typeof createFakeProvider>;
  loginPath?: string;
  onUnauthenticated?: (loginPath: string) => void;
};

function renderSession({
  fake,
  loginPath = "/sign-in",
  onUnauthenticated,
}: RenderSessionOptions) {
  render(
    <SessionProvider provider={fake.provider}>
      <SessionProbe />
      <RequireSession
        loginPath={loginPath}
        onUnauthenticated={onUnauthenticated}
      >
        <SessionControls />
        <span>Protected area</span>
      </RequireSession>
    </SessionProvider>,
  );
}

describe("RequireSession", () => {
  it("calls the login redirect when no session exists", async () => {
    const fake = createFakeProvider(null);
    const onUnauthenticated = vi.fn();

    renderSession({ fake, onUnauthenticated });

    await waitFor(() =>
      expect(onUnauthenticated).toHaveBeenCalledWith("/sign-in"),
    );
    expect(screen.queryByText("Protected area")).toBeNull();
    expect(fake.provider.getSession).toHaveBeenCalledTimes(1);
  });

  it("renders the protected content when a session exists", async () => {
    const fake = createFakeProvider(ALICE);
    const onUnauthenticated = vi.fn();

    renderSession({ fake, onUnauthenticated });

    expect(await screen.findByText("Protected area")).toBeDefined();
    expect(screen.getByText("Alice")).toBeDefined();
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("calls the login redirect when the session has expired", async () => {
    const fake = createFakeProvider(EXPIRED);
    const onUnauthenticated = vi.fn();

    renderSession({ fake, onUnauthenticated });

    await waitFor(() =>
      expect(onUnauthenticated).toHaveBeenCalledWith("/sign-in"),
    );
    expect(screen.queryByText("Protected area")).toBeNull();
  });
});

describe("useSession", () => {
  it("updates the session on refresh", async () => {
    const fake = createFakeProvider(ALICE);

    renderSession({ fake });
    expect(await screen.findByText("Alice")).toBeDefined();

    fake.setSession(BOB);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("Bob")).toBeDefined();
    expect(screen.queryByText("Alice")).toBeNull();
    expect(fake.provider.refresh).toHaveBeenCalledTimes(1);
  });

  it("clears the session on logout", async () => {
    const fake = createFakeProvider(ALICE);
    const onUnauthenticated = vi.fn();

    renderSession({ fake, onUnauthenticated });
    expect(await screen.findByText("Alice")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() =>
      expect(screen.getByText("unauthenticated")).toBeDefined(),
    );
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.queryByText("Protected area")).toBeNull();
    expect(fake.provider.logout).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(onUnauthenticated).toHaveBeenCalledWith("/sign-in"),
    );
  });
});
