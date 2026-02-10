import {
  createContext,
  ReactNode,
  useCallback,
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
  const i18n = useI18n();

  const fallbackT = useCallback((key: string) => key, []);
  const [t, setT] = useState(() => fallbackT);

  useEffect(() => {
    if (i18n) {
      const realT = i18n.getFixedT(null, ns);
      setT(() => realT);
    } else {
      setT(() => fallbackT);
    }
  }, [i18n, ns, fallbackT]);

  return { t, i18n };
}

export function useI18n() {
  const context = useContext(I18nContext);

  return context;
}
