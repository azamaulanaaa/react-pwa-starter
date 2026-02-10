import type { GlobalProvider } from "@ladle/react";

import "./components.css";
import { I18nProvider } from "@/component/i18n_context.tsx";
import { syncZodLocale } from "@/lib/zod.ts";

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
