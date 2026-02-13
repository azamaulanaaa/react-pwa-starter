import type { GlobalProvider } from "@ladle/react";

import "./components.css";
import { I18nProvider } from "../src/component/i18n_context.tsx";
import { syncZodLocale } from "../src/lib/zod.ts";

export const Provider: GlobalProvider = ({
  children,
}) => {
  const handleOnLanguageChange = (lng: string) => {
    syncZodLocale(lng);
  };

  return (
    <I18nProvider onLanguageChange={handleOnLanguageChange}>
      {children}
    </I18nProvider>
  );
};
