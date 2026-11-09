import type * as React from "react";

import { useTranslation } from "@/components/context/translation.tsx";
import {
  OAuthProviderIcon,
  type OAuthProvider,
} from "@/components/auth/provider-icon.tsx";
import { Button, type ButtonProps } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils/cn.ts";

const PROVIDER_LABEL_KEYS: Record<OAuthProvider, string> = {
  apple: "auth_provider_apple",
  github: "auth_provider_github",
  google: "auth_provider_google",
  microsoft: "auth_provider_microsoft",
  oidc: "auth_provider_oidc",
};

export interface OAuthButtonProps extends Omit<ButtonProps, "children"> {
  provider: OAuthProvider;
  label?: string;
  loading?: boolean;
  onLogin?: (provider: OAuthProvider) => void;
}

export function OAuthButton({
  provider,
  label,
  loading = false,
  onLogin,
  onClick,
  disabled,
  variant = "outline",
  size = "default",
  className,
  ...props
}: OAuthButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const text =
    label ??
    t("auth_oauth_continue", {
      provider: t(PROVIDER_LABEL_KEYS[provider]),
    });

  return (
    <Button
      className={cn("w-full justify-center", className)}
      data-provider={provider}
      data-slot="oauth-button"
      disabled={disabled || loading}
      loading={loading}
      onClick={(event) => {
        onClick?.(event);

        if (!loading && !disabled) onLogin?.(provider);
      }}
      size={size}
      variant={variant}
      {...props}
    >
      <OAuthProviderIcon provider={provider} />
      {text}
    </Button>
  );
}
