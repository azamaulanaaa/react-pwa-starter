import { useEffect, useRef } from "react";

import { useSession } from "@/components/context/session.tsx";
import type { ResetDependencyOverrides } from "@/hooks/use-reset-dependencies.ts";
import { useResetDependencies } from "@/hooks/use-reset-dependencies.ts";
import { resetSession } from "@/lib/auth/reset.ts";

/** Defines the options for the session reset hook. */
export type UseSessionResetOptions = ResetDependencyOverrides;

const NO_LOGOUT = async (): Promise<void> => {};

/**
 * Clears the user data when the session user changes.
 * The hook does not clear the data on the first session load.
 * The hook keeps the outbox when the reset has an unsent write.
 * The session provider writes the session cache, so the hook leaves it.
 */
export function useSessionReset(options: UseSessionResetOptions = {}): void {
  const { session, status } = useSession();
  const dependencies = useResetDependencies(options);
  const previousUser = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user.id ?? null;

    if (status !== "authenticated" || userId === null) {
      if (status === "unauthenticated") previousUser.current = null;

      return;
    }

    const previous = previousUser.current;
    previousUser.current = userId;

    if (previous === null || previous === userId) return;

    void resetSession({
      ...dependencies,
      clearSessionCache: () => {},
      logout: NO_LOGOUT,
    });
  }, [dependencies, session, status]);
}
