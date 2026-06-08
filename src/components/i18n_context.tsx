import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { i18nreact } from "@/lib/i18n.ts";

const i18nPromise = i18nreact("ui");

export type I18nProviderProps = {
  onLanguageChange: (lng: string) => void;
  children: ReactNode;
};

const I18nContext = createContext<null | Awaited<typeof i18nPromise>>(null);

export function I18nProvider(
  { onLanguageChange, children }: I18nProviderProps,
) {
  const [i18n, setI18n] = useState<null | Awaited<typeof i18nPromise>>(null);

  useEffect(() => {
    let isMounted = true;

    i18nPromise.then((instance) => {
      if (isMounted) {
        setI18n(instance);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!i18n) return;

    onLanguageChange(i18n.language);
    i18n.on("languageChanged", onLanguageChange);

    return () => {
      i18n.off("languageChanged", onLanguageChange);
    };
  }, [i18n, onLanguageChange]);

  return (
    <I18nContext.Provider value={i18n}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(ns: string) {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within a I18nProvider");
  }

  return { t: context.getFixedT(null, ns), i18n: context };
}

export function useI18n() {
  const context = useContext(I18nContext);

  return context;
}
