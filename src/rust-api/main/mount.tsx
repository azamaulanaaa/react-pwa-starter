import type { ReactNode } from "react";

import { createRustApiBackendIfEnabled } from "./backend.ts";
import { RustApiSessionBoundary } from "./boundary.tsx";

// One composition root for the optional rust-api backend. The switch is off by default.
const RUST_API_BACKEND = createRustApiBackendIfEnabled();

/** Defines the props for the rust-api mount. */
export interface RustApiMountProps {
  /** The application tree. */
  children: ReactNode;
}

/**
 * Provides the rust-api session provider to the application tree.
 * The component mounts one backend for the module lifetime.
 */
export default function RustApiMount({ children }: RustApiMountProps) {
  return (
    <RustApiSessionBoundary backend={RUST_API_BACKEND}>
      {children}
    </RustApiSessionBoundary>
  );
}
