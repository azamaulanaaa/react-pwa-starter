// @vitest-environment jsdom
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/components/context/translation.tsx";
import {
  buildCallbackPath,
  readLoginSearch,
  RustApiAuthCard,
} from "@/rust-api/main/auth-ui.tsx";
import type { Session, SessionStatus } from "@/lib/auth/types.ts";

const mocks = vi.hoisted(() => ({
  useRustApiBackend: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/rust-api/main/boundary.tsx", () => ({
  useRustApiBackend: mocks.useRustApiBackend,
}));

vi.mock("@/components/context/session.tsx", () => ({
  useSession: mocks.useSession,
}));

const SESSION: Session = {
  user: {
    email: "alice@example.com",
    id: "user-1",
    name: "Alice",
  },
  expiresAt: 4_102_444_800_000,
};

const DICTIONARY = {
  auth_error_access_denied:
    "The provider denied access. Select a provider to try again.",
  auth_error_default: "The sign-in did not complete. Try again.",
  auth_error_title: "Sign-in error",
  auth_loading: "Loading...",
  auth_oauth_continue: "Continue with {{provider}}",
  auth_provider_oidc: "OpenID Connect",
  auth_retry: "Try again",
  auth_rust_api_login_failed: "The login failed. Try again.",
  auth_rust_api_off_description:
    "Set VITE_RUST_API_ENABLED to true to use the rust-api login.",
  auth_rust_api_off_title: "Rust API is off",
  auth_sign_in_description: "Select a provider to continue.",
  auth_sign_in_title: "Sign in",
};

function createSessionState() {
  return {
    session: null as Session | null,
    status: "unauthenticated" as SessionStatus,
    error: null as Error | null,
    login: vi.fn(async (): Promise<void> => {}),
    logout: vi.fn(async (): Promise<void> => {}),
    refresh: vi.fn(async (): Promise<Session | null> => null),
  };
}

let sessionState = createSessionState();

function renderCard(ui: ReactElement) {
  return render(
    <TranslationProvider dictionary={DICTIONARY}>{ui}</TranslationProvider>,
  );
}

beforeEach(() => {
  window.history.replaceState({}, "", "/login");
  vi.clearAllMocks();
  sessionState = createSessionState();
  mocks.useRustApiBackend.mockReturnValue({ session: {} });
  mocks.useSession.mockReturnValue(sessionState);
});

describe("readLoginSearch", () => {
  it("keeps a safe return path and rejects an unsafe return path", () => {
    expect(
      readLoginSearch("?error=access_denied&returnTo=%2Fsettings"),
    ).toEqual({
      error: "access_denied",
      returnTo: "/settings",
    });
    expect(readLoginSearch("?returnTo=https%3A%2F%2Fevil.test")).toEqual({
      error: null,
      returnTo: null,
    });
  });
});

describe("buildCallbackPath", () => {
  it("encodes the path and uses the root for an unsafe path", () => {
    expect(buildCallbackPath("/login", "/settings")).toBe(
      "/login?returnTo=%2Fsettings",
    );
    expect(buildCallbackPath("/login", "https://evil.test")).toBe(
      "/login?returnTo=%2F",
    );
  });
});

describe("RustApiAuthCard", () => {
  it("shows the off message without a session hook", () => {
    mocks.useRustApiBackend.mockReturnValue(null);

    renderCard(<RustApiAuthCard />);

    expect(screen.getByText(DICTIONARY.auth_rust_api_off_title)).not.toBeNull();
    expect(mocks.useSession).not.toHaveBeenCalled();
  });

  it("sends the callback path to the login call", async () => {
    window.history.replaceState({}, "", "/login?returnTo=%2Fsettings");

    renderCard(<RustApiAuthCard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with OpenID Connect" }),
    );

    await waitFor(() =>
      expect(sessionState.login).toHaveBeenCalledWith({
        returnTo: "/login?returnTo=%2Fsettings",
      }),
    );
  });

  it("shows the callback error message", () => {
    window.history.replaceState({}, "", "/login?error=access_denied");

    renderCard(<RustApiAuthCard />);

    expect(screen.getByRole("alert").textContent).toContain(
      DICTIONARY.auth_error_access_denied,
    );
  });

  it("shows the local error when the login call rejects", async () => {
    sessionState.login.mockRejectedValueOnce("denied");

    renderCard(<RustApiAuthCard />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with OpenID Connect" }),
    );

    expect(
      await screen.findByText(DICTIONARY.auth_rust_api_login_failed),
    ).not.toBeNull();
  });

  it("navigates one time to the final path", async () => {
    window.history.replaceState({}, "", "/login?returnTo=%2Fsettings");
    sessionState.session = SESSION;
    sessionState.status = "authenticated";

    const navigate = vi.fn();
    const nextNavigate = vi.fn();
    const { rerender } = renderCard(<RustApiAuthCard navigate={navigate} />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/settings"));

    rerender(
      <TranslationProvider dictionary={DICTIONARY}>
        <RustApiAuthCard navigate={nextNavigate} />
      </TranslationProvider>,
    );

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(nextNavigate).not.toHaveBeenCalled();
  });

  it("sends the session to the authenticated callback", async () => {
    sessionState.session = SESSION;
    sessionState.status = "authenticated";

    const navigate = vi.fn();
    const onAuthenticated = vi.fn();

    renderCard(
      <RustApiAuthCard navigate={navigate} onAuthenticated={onAuthenticated} />,
    );

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(SESSION));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows the loading label", () => {
    sessionState.status = "loading";

    renderCard(<RustApiAuthCard />);

    expect(screen.getByText(DICTIONARY.auth_loading)).not.toBeNull();
  });
});
