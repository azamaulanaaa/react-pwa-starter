import { useCallback, useState } from "react";

import { useSession } from "@/components/context/session.tsx";
import type { ResetDependencyOverrides } from "@/hooks/use-reset-dependencies.ts";
import { useResetDependencies } from "@/hooks/use-reset-dependencies.ts";
import {
  resetSession,
  type SessionResetResult,
  toResetError,
} from "@/lib/auth/reset.ts";

/** Defines the options for the safe logout hook. */
export type UseSafeLogoutOptions = ResetDependencyOverrides;

/** Defines the result of the safe logout hook. */
export interface UseSafeLogoutResult {
  /** Runs the reset, then ends the session. */
  logout: () => Promise<SessionResetResult>;
  /** The flag is true while the reset runs. */
  running: boolean;
  /** The last reset error. The value is null when no error exists. */
  error: Error | null;
}

/**
 * Ends the session after the reset.
 * The hook blocks the logout when the outbox has a pending or sending write.
 * The hook runs every clear step before it reports the first failure.
 */
export function useSafeLogout(
  options: UseSafeLogoutOptions = {},
): UseSafeLogoutResult {
  const session = useSession();
  const dependencies = useResetDependencies(options);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const logout = useCallback(async (): Promise<SessionResetResult> => {
    setRunning(true);
    setError(null);

    try {
      const result = await resetSession({
        ...dependencies,
        logout: session.logout,
      });

      if (!result.ok && result.reason === "reset_failed") {
        setError(toResetError(result.error));
      }

      return result;
    } finally {
      setRunning(false);
    }
  }, [dependencies, session.logout]);

  return { logout, running, error };
}
