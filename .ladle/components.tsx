import { ReactNode, useEffect } from "react";
import type { GlobalProvider } from "@ladle/react";

import "./components.css";
import { useHtmlLang } from "@/hooks/use-html-lang.ts";
import { I18nProvider, useI18n } from "@/components/context/i18n.tsx";
import { IntlProvider, useIntl } from "@/components/context/intl.tsx";

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-lg font-medium">Loading...</div>
    </div>
  );
}

function AppInitializerGuard({ children }: { children: ReactNode }) {
  const i18n = useI18n();
  const intl = useIntl();

  const isLoading = !i18n || !intl;

  if (isLoading) return <Loading />;

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
  const locale = useHtmlLang();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <I18nProvider locale={locale}>
      <IntlProvider locale={locale}>
        <AppInitializerGuard>
          {children}
        </AppInitializerGuard>
      </IntlProvider>
    </I18nProvider>
  );
};
