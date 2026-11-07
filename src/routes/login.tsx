import { createFileRoute } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth/auth-shell.tsx";
import { RustApiAuthCard } from "@/integrations/rust-api/auth-ui.tsx";

function Page() {
  return (
    <AuthShell>
      <RustApiAuthCard />
    </AuthShell>
  );
}

export const Route = createFileRoute("/login")({
  component: Page,
});
