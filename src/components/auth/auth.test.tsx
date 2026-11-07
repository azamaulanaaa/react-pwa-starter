// @vitest-environment jsdom
import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccessDenied } from "@/components/auth/access-denied.tsx";
import { AuthCard } from "@/components/auth/auth-card.tsx";
import { AuthError } from "@/components/auth/auth-error.tsx";
import { AuthLoading } from "@/components/auth/auth-loading.tsx";
import { OAuthButton } from "@/components/auth/oauth-button.tsx";
import { OAuthProviderList } from "@/components/auth/oauth-provider-list.tsx";
import { SessionUserMenu, UserMenu } from "@/components/auth/user-menu.tsx";
import { SessionProvider } from "@/components/context/session.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import type {
  Session,
  SessionProvider as SessionProviderContract,
} from "@/lib/auth/types.ts";

const DICTIONARY = {
  auth_access_denied_description:
    "You do not have permission to open this page.",
  auth_access_denied_title: "Access denied",
  auth_error_access_denied:
    "The provider denied access. Select a provider to try again.",
  auth_error_authentication_failed: "The sign-in failed. Try again.",
  auth_error_default: "The sign-in did not complete. Try again.",
  auth_error_invalid_state:
    "The sign-in request is not valid. Start the sign-in again.",
  auth_error_security_cookies_missing:
    "The browser blocked the security cookies. Enable cookies and try again.",
  auth_error_title: "Sign-in error",
  auth_loading: "Loading...",
  auth_menu_label: "Open the user menu",
  auth_oauth_continue: "Continue with {{provider}}",
  auth_profile: "Profile",
  auth_provider_apple: "Apple",
  auth_provider_github: "GitHub",
  auth_provider_google: "Google",
  auth_provider_microsoft: "Microsoft",
  auth_provider_oidc: "OpenID Connect",
  auth_retry: "Try again",
  auth_sign_in: "Sign in",
  auth_sign_in_description: "Select a provider to continue.",
  auth_sign_in_title: "Sign in",
  auth_sign_out: "Sign out",
  auth_signed_in_as: "Signed in as {{name}}",
};

const ALICE: Session = {
  user: {
    email: "alice@example.com",
    id: "user-1",
    name: "Alice",
  },
  expiresAt: 4_102_444_800_000,
};

function renderTranslated(ui: ReactElement) {
  return render(
    <TranslationProvider dictionary={DICTIONARY}>{ui}</TranslationProvider>,
  );
}

function createFakeProvider(session: Session | null) {
  return {
    getSession: vi.fn(async (): Promise<Session | null> => session),
    login: vi.fn(async (): Promise<void> => {}),
    logout: vi.fn(async (): Promise<void> => {}),
    refresh: vi.fn(async (): Promise<Session | null> => session),
  } satisfies SessionProviderContract;
}

describe("OAuthButton", () => {
  it("renders the provider label and sends the provider", () => {
    const onLogin = vi.fn();

    renderTranslated(<OAuthButton onLogin={onLogin} provider="google" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    expect(onLogin).toHaveBeenCalledWith("google");
  });

  it("does not send a login while loading", () => {
    const onLogin = vi.fn();

    renderTranslated(
      <OAuthButton loading onLogin={onLogin} provider="github" />,
    );

    const button = screen.getByRole("button", {
      name: "Continue with GitHub",
    });

    expect(button.hasAttribute("disabled")).toBe(true);

    fireEvent.click(button);

    expect(onLogin).not.toHaveBeenCalled();
  });
});

describe("OAuthProviderList", () => {
  it("renders the providers in order and marks the loading provider", () => {
    renderTranslated(
      <OAuthProviderList
        loadingProvider="github"
        providers={["google", "github", "apple"]}
      />,
    );

    const buttons = screen.getAllByRole("button");

    expect(
      buttons.map((button) => button.getAttribute("data-provider")),
    ).toEqual(["google", "github", "apple"]);
    expect(buttons[1].hasAttribute("disabled")).toBe(true);
  });
});

describe("AuthCard", () => {
  it("renders the card content", () => {
    renderTranslated(
      <AuthCard
        error="A custom error."
        footer={<span>Footer text</span>}
        providers={["google", "github"]}
      />,
    );

    expect(screen.getByText("Sign in")).not.toBeNull();
    expect(screen.getByText("Select a provider to continue.")).not.toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("alert").textContent).toContain("A custom error.");
    expect(screen.getByText("Footer text")).not.toBeNull();
  });
});

describe("AuthError", () => {
  it("uses the code message for a known code", () => {
    renderTranslated(<AuthError code="access_denied" />);

    expect(screen.getByRole("alert").textContent).toContain(
      DICTIONARY.auth_error_access_denied,
    );
  });

  it("uses the default message for an unknown code", () => {
    renderTranslated(<AuthError code="unknown_code" />);

    expect(screen.getByRole("alert").textContent).toContain(
      DICTIONARY.auth_error_default,
    );
  });
});

describe("AccessDenied", () => {
  it("calls both access actions", () => {
    const onRetry = vi.fn();
    const onSignIn = vi.fn();

    renderTranslated(<AccessDenied onRetry={onRetry} onSignIn={onSignIn} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});

describe("AuthLoading", () => {
  it("shows the default loading label", () => {
    renderTranslated(<AuthLoading />);

    expect(screen.getByText("Loading...")).not.toBeNull();
  });
});

describe("UserMenu", () => {
  it("opens the user menu and signs out", async () => {
    const onSignOut = vi.fn();

    renderTranslated(<UserMenu onSignOut={onSignOut} user={ALICE.user} />);

    fireEvent.click(
      screen.getByRole("button", { name: DICTIONARY.auth_menu_label }),
    );

    expect(await screen.findByText("Signed in as Alice")).not.toBeNull();
    expect(screen.getByText("alice@example.com")).not.toBeNull();

    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("SessionUserMenu", () => {
  it("returns null without a session", () => {
    const provider = createFakeProvider(null);

    const { container } = renderTranslated(
      <SessionProvider provider={provider}>
        <SessionUserMenu />
      </SessionProvider>,
    );

    expect(
      container.querySelector('[data-slot="user-menu-trigger"]'),
    ).toBeNull();
  });

  it("logs out with a session", async () => {
    const provider = createFakeProvider(ALICE);

    renderTranslated(
      <SessionProvider provider={provider}>
        <SessionUserMenu />
      </SessionProvider>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: DICTIONARY.auth_menu_label,
      }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));

    expect(provider.logout).toHaveBeenCalledTimes(1);
  });
});
