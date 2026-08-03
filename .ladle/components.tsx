import { useEffect } from "react";
import type { GlobalProvider } from "@ladle/react";

import "./components.css";
import { useNavigatorLanguage } from "@/hooks/use-navigator-language.ts";
import { TranslationProvider } from "@/components/context/translation.tsx";
import { IntlProvider } from "@/components/context/intl.tsx";
import dictionary from "../public/locales/en-US.json" with { type: "json" };

export const Provider: GlobalProvider = ({
  children,
  globalState,
}) => {
  const isDarkMode = globalState.theme === "dark";
  const locale = useNavigatorLanguage();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      <IntlProvider locale={locale}>
        {children}
      </IntlProvider>
    </TranslationProvider>
  );
};
