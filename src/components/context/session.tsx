import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toSessionError } from "@/lib/auth/error.ts";
import { activeSession } from "@/lib/auth/session.ts";
import type {
  LoginOptions,
  Session,
  SessionProvider as SessionProviderContract,
  SessionStatus,
} from "@/lib/auth/types.ts";

/** Defines the value of the session context. */
export interface SessionContextValue {
  /** The current session. The value is null when no session exists. */
  session: Session | null;
  /** The current state of the session. */
  status: SessionStatus;
  /** The last session error. The value is null when no error exists. */
  error: Error | null;
  /** Starts the login flow and loads the new session. */
  login: (options?: LoginOptions) => Promise<void>;
  /** Ends the session and clears the state. */
  logout: () => Promise<void>;
  /** Renews the session and updates the state. */
  refresh: () => Promise<Session | null>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Defines the props for the session provider. */
export interface SessionProviderProps {
  children: ReactNode;
  /** The backend adapter that implements the session contract. */
  provider: SessionProviderContract;
}

/**
 * Provides the session state to the component tree.
 * The provider loads the session one time when it mounts.
 * The provider does not redirect. The guard does that.
 */
export function SessionProvider({ children, provider }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<Error | null>(null);

  const applySession = useCallback((next: Session | null) => {
    setSession(next);
    setStatus(next === null ? "unauthenticated" : "authenticated");
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const next = activeSession(await provider.getSession());
        if (!active) return;

        setError(null);
        applySession(next);
      } catch (cause) {
        if (!active) return;

        setError(toSessionError(cause));
        applySession(null);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [applySession, provider]);

  const login = useCallback(
    async (options?: LoginOptions) => {
      await provider.login(options);

      const next = activeSession(await provider.getSession());
      setError(null);
      applySession(next);
    },
    [applySession, provider],
  );

  const logout = useCallback(async () => {
    try {
      await provider.logout();
    } finally {
      setError(null);
      applySession(null);
    }
  }, [applySession, provider]);

  const refresh = useCallback(async () => {
    try {
      const next = activeSession(await provider.refresh());
      setError(null);
      applySession(next);

      return next;
    } catch (cause) {
      const sessionError = toSessionError(cause);
      setError(sessionError);
      throw sessionError;
    }
  }, [applySession, provider]);

  const value = useMemo<SessionContextValue>(
    () => ({ session, status, error, login, logout, refresh }),
    [error, login, logout, refresh, session, status],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** Returns the session state of the nearest session provider. */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}

/** Defines the props for the session guard. */
export interface RequireSessionProps {
  children: ReactNode;
  /**
   * The path for a user without a session.
   * The default is `/login`.
   */
  loginPath?: string;
  /**
   * Replaces the redirect.
   * The guard calls it with the login path.
   */
  onUnauthenticated?: (loginPath: string) => void;
  /** The content to show while the session loads. The default is nothing. */
  fallback?: ReactNode;
}

/**
 * Renders the child content only when a session exists.
 * The guard calls the login callback or redirects when no session exists.
 * The guard redirects one time for each unauthenticated state.
 */
export function RequireSession({
  children,
  loginPath = "/login",
  onUnauthenticated,
  fallback = null,
}: RequireSessionProps) {
  const { session, status } = useSession();
  const redirected = useRef(false);

  useEffect(() => {
    if (status !== "unauthenticated") {
      redirected.current = false;

      return;
    }

    if (redirected.current) return;
    redirected.current = true;

    if (onUnauthenticated) {
      onUnauthenticated(loginPath);

      return;
    }

    if (typeof window !== "undefined") {
      window.location.assign(loginPath);
    }
  }, [loginPath, onUnauthenticated, status]);

  if (status === "loading") return <>{fallback}</>;

  if (status === "unauthenticated" || session === null) return null;

  return <>{children}</>;
}
