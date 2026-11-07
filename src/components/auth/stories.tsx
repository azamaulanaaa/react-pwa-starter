import type { Story, StoryDefault } from "@ladle/react";

import { AccessDenied as AccessDeniedComponent } from "@/components/auth/access-denied.tsx";
import { AuthCard } from "@/components/auth/auth-card.tsx";
import { AuthLoading as AuthLoadingComponent } from "@/components/auth/auth-loading.tsx";
import { OAuthButton as OAuthButtonComponent } from "@/components/auth/oauth-button.tsx";
import { OAuthProviderList } from "@/components/auth/oauth-provider-list.tsx";
import type { OAuthProvider } from "@/components/auth/provider-icon.tsx";
import {
  SessionUserMenu as SessionUserMenuComponent,
  UserMenu as UserMenuComponent,
} from "@/components/auth/user-menu.tsx";
import { SessionProvider } from "@/components/context/session.tsx";
import type {
  Session,
  SessionProvider as SessionProviderContract,
} from "@/lib/auth/types.ts";

const SESSION: Session = {
  user: {
    email: "ada@example.com",
    id: "user-1",
    name: "Ada Lovelace",
  },
  expiresAt: 4_102_444_800_000,
};

const SESSION_PROVIDER: SessionProviderContract = {
  getSession: async () => SESSION,
  login: async () => {},
  logout: async () => {},
  refresh: async () => SESSION,
};

const PROVIDERS: OAuthProvider[] = [
  "google",
  "github",
  "microsoft",
  "apple",
  "oidc",
];

function handleLogin(provider: OAuthProvider): void {
  alert(`Provider: ${provider}`);
}

export default {
  title: "Auth",
} as StoryDefault;

export const OAuthButton: Story = () => (
  <div className="w-80">
    <OAuthButtonComponent onLogin={handleLogin} provider="google" />
  </div>
);

export const ProviderList: Story = () => (
  <div className="w-80">
    <OAuthProviderList onLogin={handleLogin} providers={PROVIDERS} />
  </div>
);

export const SignInCard: Story = () => (
  <div className="w-full max-w-sm">
    <AuthCard onLogin={handleLogin} providers={PROVIDERS} />
  </div>
);

export const SignInCardWithError: Story = () => (
  <div className="w-full max-w-sm">
    <AuthCard
      errorCode="access_denied"
      onLogin={handleLogin}
      onRetry={() => alert("Retry the sign-in")}
      providers={PROVIDERS}
    />
  </div>
);

export const AccessDenied: Story = () => (
  <div className="w-full max-w-md">
    <AccessDeniedComponent
      onRetry={() => alert("Retry access")}
      onSignIn={() => alert("Open sign in")}
    />
  </div>
);

export const AuthLoading: Story = () => <AuthLoadingComponent />;

export const UserMenu: Story = () => (
  <div className="flex justify-center">
    <UserMenuComponent
      onProfile={() => alert("Open profile")}
      onSignOut={() => alert("Sign out")}
      user={SESSION.user}
    />
  </div>
);

export const SessionUserMenu: Story = () => (
  <div className="flex justify-center">
    <SessionProvider provider={SESSION_PROVIDER}>
      <SessionUserMenuComponent onProfile={() => alert("Open profile")} />
    </SessionProvider>
  </div>
);
