import { ReactNode } from "react";
import type { GlobalProvider } from "@ladle/react";

import "./components.css";
import { I18nProvider, useI18n } from "../src/component/i18n_context.tsx";
import { syncZodLocale } from "../src/lib/zod.ts";
import { cn } from "../src/lib/cn.ts";

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
  const handleOnLanguageChange = (lng: string) => {
    syncZodLocale(lng);
  };

  const isDarkMode = globalState.theme === "dark";

  return (
    <I18nProvider onLanguageChange={handleOnLanguageChange}>
      <AppInitializerGuard>
        <div className={cn({ "dark": isDarkMode })}>
          {children}
        </div>
      </AppInitializerGuard>
    </I18nProvider>
  );
};
