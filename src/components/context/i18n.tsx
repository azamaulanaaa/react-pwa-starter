import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { i18nbase } from "@/lib/i18n.ts";

const i18nPromise = i18nbase("ui");

export type I18nProviderProps = {
  children: ReactNode;
  locale: string;
};

const I18nContext = createContext<null | Awaited<typeof i18nPromise>>(null);

export function I18nProvider(
  props: I18nProviderProps,
) {
  const [i18n, setI18n] = useState<null | Awaited<typeof i18nPromise>>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const i18n = await i18nPromise;
      if (isMounted) {
        if (i18n.language != props.locale) {
          i18n.changeLanguage(props.locale);
        }
        setI18n(i18n);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <I18nContext.Provider value={i18n}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useTranslation(ns: string) {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within a I18nProvider");
  }

  const fixedT = context.getFixedT(null, ns as any);

  return { t: fixedT, i18n: context };
}

export function useI18n() {
  const context = useContext(I18nContext);

  return context;
}
