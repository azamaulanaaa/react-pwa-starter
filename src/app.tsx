import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen.ts";

import { type Config, ConfigProvider } from "@/components/context/config.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import { WorkerProvider } from "@/components/context/worker.tsx";
import { IntlProvider } from "@/components/context/intl.tsx";
import { usePersistState } from "@/hooks/primitives/use-persist-state.ts";
import { useSystemDarkMode } from "@/hooks/primitives/use-system-dark-mode.ts";
import { useNavigatorLanguage } from "@/hooks/primitives/use-navigator-language.ts";
import { RustApiMount } from "@/rust-api/optional.tsx";

// Create a new router instance
export const router = createRouter({ routeTree });

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

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur", "yi"]);

/** Returns the text direction for one locale. */
function getDirection(locale: string): "ltr" | "rtl" {
  const language = locale.split("-")[0]?.toLowerCase() ?? "";

  return RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
}

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
  }, [config.locale, systemLocale]);

  useLayoutEffect(() => {
    const isDarkMode =
      config.theme === "dark" ||
      (config.theme === "system" && isSystemDarkMode);
    const root = document.documentElement;

    root.classList.toggle("dark", isDarkMode);
    root.style.colorScheme = isDarkMode ? "dark" : "light";
  }, [config.theme, isSystemDarkMode]);

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.lang = locale || "en";
    root.dir = getDirection(locale);
  }, [locale]);

  const [dictionary, setDictionary] = useState({});
  const [fallbackDictionary, setFallbackDictionary] = useState({});

  useEffect(() => {
    if (locale === "") return;
    const controller = new AbortController();
    fetch(`/locales/${locale}.json`, { signal: controller.signal })
      .then((res) => res.json())
      .then((next) => {
        if (!controller.signal.aborted) setDictionary(next);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
      });
    return () => controller.abort();
  }, [locale]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/locales/en-US.json`, { signal: controller.signal })
      .then((res) => res.json())
      .then((next) => {
        if (!controller.signal.aborted) setFallbackDictionary(next);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
      });
    return () => controller.abort();
  }, []);

  return (
    <ConfigProvider config={config} setConfig={setConfig}>
      <TranslationProvider
        dictionary={dictionary}
        fallbackDictionary={fallbackDictionary}
      >
        <WorkerProvider>
          <IntlProvider locale={locale}>
            <RustApiMount>
              <RouterProvider router={router} />
            </RustApiMount>
          </IntlProvider>
        </WorkerProvider>
      </TranslationProvider>
    </ConfigProvider>
  );
}
