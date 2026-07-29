import { ReactNode, useEffect, useMemo } from "react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen.ts";

import { useWorker, WorkerProvider } from "@/components/context/worker.tsx";
import { I18nProvider, useI18n } from "@/components/context/i18n.tsx";
import { IntlProvider, useIntl } from "@/components/context/intl.tsx";
import { type Config, ConfigProvider } from "@/components/context/config.tsx";
import { usePersistState } from "@/hooks/use-persist-state.ts";
import { useSystemDarkMode } from "@/hooks/use-system-dark-mode.ts";
import { useHtmlLang } from "@/hooks/use-html-lang.ts";
import { Spinner } from "@/components/ui/spinner.tsx";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const DEFAULT_CONFIG: Config = {
  theme: "system",
  locale: null,
};

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}

function AppInitializerGuard({ children }: { children: ReactNode }) {
  const worker = useWorker();
  const i18n = useI18n();
  const intl = useIntl();

  const isLoading = !worker || !i18n || !intl;

  if (isLoading) return <Loading />;

  return (
    <>
      {children}
    </>
  );
}

export function App() {
  const [config, setConfig] = usePersistState<Config>(
    "app_config",
    DEFAULT_CONFIG,
  );

  const isSystemDarkMode = useSystemDarkMode();
  const systemLocale = useHtmlLang();

  const locale = useMemo(() => config.locale ?? systemLocale, [
    config.locale,
    systemLocale,
  ]);

  useEffect(() => {
    const isDarkMode = config.theme === "dark" ||
      config.theme === "system" && isSystemDarkMode;
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [config.theme, isSystemDarkMode]);

  return (
    <ConfigProvider config={config} setConfig={setConfig}>
      <WorkerProvider locale={locale}>
        <I18nProvider locale={locale}>
          <IntlProvider locale={locale}>
            <AppInitializerGuard>
              <RouterProvider router={router} />
            </AppInitializerGuard>
          </IntlProvider>
        </I18nProvider>
      </WorkerProvider>
    </ConfigProvider>
  );
}
