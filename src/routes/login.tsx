import { createFileRoute } from "@tanstack/react-router";

import { AuthCard } from "@/components/auth/auth-card.tsx";
import { AuthShell } from "@/components/auth/auth-shell.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import { RUST_API_ENABLED, RustApiLoginPanel } from "@/rust-api/optional.tsx";

function Page() {
  const { t } = useTranslation();

  return (
    <AuthShell>
      {RUST_API_ENABLED ? (
        <RustApiLoginPanel />
      ) : (
        <AuthCard
          description={t("auth_rust_api_off_description")}
          providers={[]}
          title={t("auth_rust_api_off_title")}
        />
      )}
    </AuthShell>
  );
}

export const Route = createFileRoute("/login")({
  component: Page,
});
