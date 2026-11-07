import { useEffect, useRef, useState, type ReactNode } from "react";

import { AuthCard } from "@/components/auth/auth-card.tsx";
import { AuthLoading } from "@/components/auth/auth-loading.tsx";
import type { OAuthProvider } from "@/components/auth/provider-icon.tsx";
import { useRustApiBackend } from "@/components/context/rust-api.tsx";
import { useSession } from "@/components/context/session.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import { safeReturnTo } from "@/lib/auth/return-to.ts";
import type { Session } from "@/lib/auth/types.ts";

/** Defines the login query values. */
export interface LoginSearch {
  /** The stable error code from the callback. */
  error: string | null;
  /** The safe relative path after login. */
  returnTo: string | null;
}

/** Reads the login query values and rejects an unsafe return path. */
export function readLoginSearch(search: string): LoginSearch {
  const params = new URLSearchParams(search);

  return {
    error: params.get("error"),
    returnTo: safeReturnTo(params.get("returnTo") ?? undefined),
  };
}

/** Builds the callback path with a safe return path. */
export function buildCallbackPath(pathname: string, returnTo: string): string {
  const path = safeReturnTo(returnTo) ?? "/";
  const params = new URLSearchParams({ returnTo: path });

  return `${pathname}?${params.toString()}`;
}

/** Defines the props for the rust-api authentication card. */
export interface RustApiAuthCardProps {
  /** The visual provider list. The default is `["oidc"]`. */
  providers?: OAuthProvider[];
  /** The path after login. The value must be relative and safe. */
  returnTo?: string;
  /** The card title. */
  title?: ReactNode;
  /** The card description. */
  description?: ReactNode;
  /** The card footer. */
  footer?: ReactNode;
  /** The card logo. */
  logo?: ReactNode;
  /** Opens one path after login. The default uses `window.location.assign`. */
  navigate?: (path: string) => void;
  /** Receives the session after login. The callback takes priority over `navigate`. */
  onAuthenticated?: (session: Session) => void;
  /** The card class name. */
  className?: string;
}

/** Renders the rust-api authentication card when the backend exists. */
function ConnectedRustApiAuthCard(
  props: RustApiAuthCardProps,
): React.ReactElement {
  const { t } = useTranslation();
  const { error, login, session, status } = useSession();
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(
    null,
  );
  const navigated = useRef(false);
  const search = readLoginSearch(window.location.search);
  const finalPath = safeReturnTo(props.returnTo) ?? search.returnTo ?? "/";
  const errorCode = search.error;
  const errorMessage = localError ?? error?.message ?? null;
  const providers = props.providers ?? ["oidc"];

  useEffect(() => {
    if (status !== "authenticated" || session === null) return;
    if (navigated.current) return;

    navigated.current = true;

    if (props.onAuthenticated) {
      props.onAuthenticated(session);

      return;
    }

    if (props.navigate) {
      props.navigate(finalPath);

      return;
    }

    window.location.assign(finalPath);
  }, [finalPath, props, session, status]);

  const handleLogin = async (provider: OAuthProvider): Promise<void> => {
    setLocalError(null);
    setPendingProvider(provider);

    try {
      const callbackPath = buildCallbackPath(
        window.location.pathname,
        finalPath,
      );

      await login({ returnTo: callbackPath });
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : t("auth_rust_api_login_failed"),
      );
    } finally {
      setPendingProvider(null);
    }
  };

  const handleRetry = (): void => {
    void handleLogin("oidc");
  };

  if (status === "loading") {
    return (
      <AuthCard
        className={props.className}
        description={props.description}
        footer={props.footer}
        logo={props.logo}
        providers={[]}
        title={props.title}
      >
        <AuthLoading />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      className={props.className}
      description={props.description}
      error={errorMessage}
      errorCode={errorCode}
      footer={props.footer}
      loadingProvider={pendingProvider}
      logo={props.logo}
      onLogin={(provider) => {
        void handleLogin(provider);
      }}
      onRetry={handleRetry}
      providers={providers}
      title={props.title}
    />
  );
}

/** Renders the connected rust-api authentication card. */
export function RustApiAuthCard(
  props: RustApiAuthCardProps,
): React.ReactElement {
  const backend = useRustApiBackend();
  const { t } = useTranslation();

  if (backend === null) {
    return (
      <AuthCard
        className={props.className}
        description={t("auth_rust_api_off_description")}
        footer={props.footer}
        logo={props.logo}
        providers={[]}
        title={t("auth_rust_api_off_title")}
      />
    );
  }

  return <ConnectedRustApiAuthCard {...props} />;
}
