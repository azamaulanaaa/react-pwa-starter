import type { Story, StoryDefault } from "@ladle/react";

import { createMemoryTokenStore } from "../shared/client.ts";
import { RustApiAuthCard as RustApiAuthCardComponent } from "./auth-ui.tsx";
import { createRustApiBackendIfEnabled } from "./backend.ts";
import { RustApiSessionBoundary } from "./boundary.tsx";

const RUST_API_BACKEND = createRustApiBackendIfEnabled({
  env: {
    VITE_RUST_API_BASE_URL: "https://api.test",
    VITE_RUST_API_ENABLED: "true",
  },
  fetch: async () =>
    new Response(JSON.stringify({ error: "unauthorized" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    }),
  tokens: createMemoryTokenStore(),
});

export default {
  title: "Rust API",
} as StoryDefault;

export const RustApiAuthCard: Story = () => (
  <div className="w-full max-w-sm">
    <RustApiSessionBoundary backend={RUST_API_BACKEND}>
      <RustApiAuthCardComponent />
    </RustApiSessionBoundary>
  </div>
);

export const RustApiAuthCardOff: Story = () => (
  <div className="w-full max-w-sm">
    <RustApiAuthCardComponent />
  </div>
);
