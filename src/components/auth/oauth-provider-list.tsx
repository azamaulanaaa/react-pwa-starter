import type * as React from "react";

import { OAuthButton } from "@/components/auth/oauth-button.tsx";
import type { OAuthProvider } from "@/components/auth/provider-icon.tsx";
import { cn } from "@/lib/utils/cn.ts";

export interface OAuthProviderListProps {
  providers: OAuthProvider[];
  onLogin?: (provider: OAuthProvider) => void;
  loadingProvider?: OAuthProvider | null;
  disabled?: boolean;
  className?: string;
}

export function OAuthProviderList({
  providers,
  onLogin,
  loadingProvider = null,
  disabled = false,
  className,
}: OAuthProviderListProps): React.ReactElement {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="oauth-provider-list"
    >
      {providers.map((provider) => (
        <OAuthButton
          disabled={disabled}
          key={provider}
          loading={provider === loadingProvider}
          onLogin={onLogin}
          provider={provider}
        />
      ))}
    </div>
  );
}
