import type * as React from "react";

import { AuthError } from "@/components/auth/auth-error.tsx";
import { OAuthProviderList } from "@/components/auth/oauth-provider-list.tsx";
import type { OAuthProvider } from "@/components/auth/provider-icon.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils/cn.ts";

export interface AuthCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  logo?: React.ReactNode;
  providers: OAuthProvider[];
  onLogin?: (provider: OAuthProvider) => void;
  loadingProvider?: OAuthProvider | null;
  error?: string | null;
  errorCode?: string | null;
  onRetry?: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function AuthCard({
  title,
  description,
  logo,
  providers,
  onLogin,
  loadingProvider,
  error,
  errorCode,
  onRetry,
  footer,
  children,
  className,
}: AuthCardProps): React.ReactElement {
  const { t } = useTranslation();
  const hasError = Boolean(error || errorCode);

  return (
    <Card className={cn("w-full max-w-sm", className)} data-slot="auth-card">
      <CardHeader className="items-center justify-items-center text-center">
        {logo && (
          <div className="mb-1 flex size-12 items-center justify-center rounded-lg border border-input bg-background shadow-xs/5">
            {logo}
          </div>
        )}
        <CardTitle>{title ?? t("auth_sign_in_title")}</CardTitle>
        <CardDescription>
          {description ?? t("auth_sign_in_description")}
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        {hasError && (
          <AuthError code={errorCode} message={error} onRetry={onRetry} />
        )}
        <OAuthProviderList
          loadingProvider={loadingProvider}
          onLogin={onLogin}
          providers={providers}
        />
        {children}
      </CardPanel>
      {footer && (
        <CardFooter className="justify-center text-center text-muted-foreground text-sm">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
