import type * as React from "react";
import { CircleAlertIcon } from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";

const AUTH_ERROR_KEYS: Readonly<Record<string, string>> = {
  access_denied: "auth_error_access_denied",
  authentication_failed: "auth_error_authentication_failed",
  invalid_state: "auth_error_invalid_state",
  security_cookies_missing: "auth_error_security_cookies_missing",
};

/** Returns the translation key for a stable authentication error code. */
export function authErrorKey(code?: string | null): string | null {
  if (!code) return null;

  return AUTH_ERROR_KEYS[code] ?? null;
}

export interface AuthErrorProps {
  message?: string | null;
  code?: string | null;
  title?: string;
  onRetry?: () => void;
}

export function AuthError({
  message,
  code,
  title,
  onRetry,
}: AuthErrorProps): React.ReactElement {
  const { t } = useTranslation();
  const description = message || t(authErrorKey(code) ?? "auth_error_default");

  return (
    <Alert data-slot="auth-error" variant="error">
      <CircleAlertIcon aria-hidden="true" />
      <AlertTitle>{title ?? t("auth_error_title")}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button onClick={onRetry} size="sm" variant="outline">
            {t("auth_retry")}
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
