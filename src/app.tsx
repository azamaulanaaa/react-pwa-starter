import { useEffect, useMemo, useState } from "react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen.ts";

import { type Config, ConfigProvider } from "@/components/context/config.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import { WorkerProvider } from "@/components/context/worker.tsx";
import { IntlProvider } from "@/components/context/intl.tsx";
import { usePersistState } from "@/hooks/primitives/use-persist-state.ts";
import { useSystemDarkMode } from "@/hooks/primitives/use-system-dark-mode.ts";
import { useNavigatorLanguage } from "@/hooks/primitives/use-navigator-language.ts";

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
  locale: "",
  isSidebarOpen: true,
};

export function App() {
  const [config, setConfig] = usePersistState<Config>(
    "app_config",
    DEFAULT_CONFIG,
  );

  const isSystemDarkMode = useSystemDarkMode();
  const systemLocale = useNavigatorLanguage();

  const locale = useMemo(() => {
    if (config.locale === "") {
      return systemLocale;
    }

    return config.locale;
  }, [
    config.locale,
    systemLocale,
  ]);

  useEffect(() => {
    const isDarkMode = config.theme === "dark" ||
      config.theme === "system" && isSystemDarkMode;
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [config.theme, isSystemDarkMode]);

  const [dictionary, setDictionary] = useState({});
  const [fallbackDictionary, setFallbackDictionary] = useState({});

  useEffect(() => {
    if (locale === "") return;
    fetch(`/locales/${locale}.json`).then((res) => res.json()).then(
      setDictionary,
    ).catch(console.error);
  }, [locale]);

  useEffect(() => {
    fetch(`/locales/en-US.json`).then((res) => res.json()).then(
      setFallbackDictionary,
    ).catch(console.error);
  }, []);

  return (
    <ConfigProvider config={config} setConfig={setConfig}>
      <TranslationProvider
        dictionary={dictionary}
        fallbackDictionary={fallbackDictionary}
      >
        <WorkerProvider>
          <IntlProvider locale={locale}>
            <RouterProvider router={router} />
          </IntlProvider>
        </WorkerProvider>
      </TranslationProvider>
    </ConfigProvider>
  );
}
