import { ReactNode } from "react";
import type { GlobalProvider } from "@ladle/react";

import "./components.css";
import { I18nProvider, useI18n } from "../src/component/i18n_context.tsx";

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-lg font-medium">Loading...</div>
    </div>
  );
}

function LoadingTrigger({ children }: { children: ReactNode }) {
  const i18n = useI18n();

  if (!i18n) return <Loading />;

  return (
    <>
      {children}
    </>
  );
}

export const Provider: GlobalProvider = ({
  children,
}) => {
  return (
    <I18nProvider>
      <LoadingTrigger>
        {children}
      </LoadingTrigger>
    </I18nProvider>
  );
};
