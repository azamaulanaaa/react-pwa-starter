import { lazy, Suspense, type ReactNode } from "react";

/**
 * Reads the build-time switch.
 * The adapter accepts `1`, `true`, `yes`, and `on`.
 */
const RUST_API_ENABLED =
  import.meta.env.VITE_RUST_API_ENABLED === "1" ||
  import.meta.env.VITE_RUST_API_ENABLED === "true" ||
  import.meta.env.VITE_RUST_API_ENABLED === "yes" ||
  import.meta.env.VITE_RUST_API_ENABLED === "on";

const LazyMount = RUST_API_ENABLED
  ? lazy(() => import("./main/mount.tsx"))
  : null;

const LazyAuthCard = RUST_API_ENABLED
  ? lazy(async () => {
      const module = await import("./main/auth-ui.tsx");

      return { default: module.RustApiAuthCard };
    })
  : null;

/** Defines the props for the lazy rust-api mount. */
export interface RustApiMountProps {
  /** The application tree. The adapter wraps the tree when the switch is on. */
  children: ReactNode;
}

/**
 * Mounts the rust-api adapter on demand.
 * The component returns the children directly when the switch is off.
 * The component loads the adapter in one lazy chunk when the switch is on.
 */
export function RustApiMount({ children }: RustApiMountProps) {
  if (!RUST_API_ENABLED || LazyMount === null) return <>{children}</>;

  return (
    <Suspense fallback={null}>
      <LazyMount>{children}</LazyMount>
    </Suspense>
  );
}

/**
 * Renders the rust-api login panel on demand.
 * The component returns null when the switch is off.
 * The component loads the authentication card in one lazy chunk when the switch is on.
 */
export function RustApiLoginPanel() {
  if (!RUST_API_ENABLED || LazyAuthCard === null) return null;

  return (
    <Suspense fallback={null}>
      <LazyAuthCard />
    </Suspense>
  );
}
