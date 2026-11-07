import { createFileRoute } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth/auth-shell.tsx";
import { RustApiLoginPanel } from "@/rust-api/optional.tsx";

function Page() {
  return (
    <AuthShell>
      <RustApiLoginPanel />
    </AuthShell>
  );
}

export const Route = createFileRoute("/login")({
  component: Page,
});
