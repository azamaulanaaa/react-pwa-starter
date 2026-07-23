import { ReactNode, useEffect } from "react";
import type { GlobalProvider } from "@ladle/react";

import "./components.css";
import { I18nProvider, useI18n } from "@/components/i18n_context.tsx";

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-lg font-medium">Loading...</div>
    </div>
  );
}

function AppInitializerGuard({ children }: { children: ReactNode }) {
  const i18n = useI18n();

  if (!i18n) return <Loading />;

  return (
    <>
      {children}
    </>
  );
}

export const Provider: GlobalProvider = ({
  children,
  globalState,
}) => {
  const isDarkMode = globalState.theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <I18nProvider>
      <AppInitializerGuard>
        {children}
      </AppInitializerGuard>
    </I18nProvider>
  );
};
