import { createContext, type ReactNode, useContext } from "react";

import { SessionProvider } from "@/components/context/session.tsx";
import type { RustApiBackend } from "./backend.ts";

const RustApiBackendContext = createContext<RustApiBackend | null>(null);

/** Defines the props for the rust-api session boundary. */
export interface RustApiSessionBoundaryProps {
  children: ReactNode;
  /** The rust-api backend. The boundary mounts the session provider when this value is not null. */
  backend: RustApiBackend | null;
}

/**
 * Returns the shared rust-api backend.
 * The hook returns null when the switch is off.
 */
export function useRustApiBackend(): RustApiBackend | null {
  return useContext(RustApiBackendContext);
}

/**
 * Provides the shared rust-api backend to the child tree.
 * The boundary mounts the session provider when the backend exists.
 * The boundary renders the child tree alone when the backend is null.
 */
export function RustApiSessionBoundary({
  children,
  backend,
}: RustApiSessionBoundaryProps) {
  return (
    <RustApiBackendContext.Provider value={backend}>
      {backend === null ? (
        children
      ) : (
        <SessionProvider provider={backend.session}>{children}</SessionProvider>
      )}
    </RustApiBackendContext.Provider>
  );
}
