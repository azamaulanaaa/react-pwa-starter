import { ReactNode, useCallback } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

import "./app.css";
import { syncZodLocale } from "./lib/zod.ts";

import { useWorker, WorkerProvider } from "./component/worker_context.tsx";
import { I18nProvider, useI18n } from "./component/i18n_context.tsx";
import { Homepage } from "./page/homepage.tsx";

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-lg font-medium">Loading...</div>
    </div>
  );
}

function LoadingTrigger({ children }: { children: ReactNode }) {
  const worker = useWorker();
  const i18n = useI18n();

  if (!worker || !i18n) return <Loading />;

  return (
    <>
      {children}
    </>
  );
}

function WrappedI18nProvider({ children }: { children: ReactNode }) {
  const worker = useWorker();

  const handleOnLanguageChange = useCallback((lng: string) => {
    syncZodLocale(lng);

    if (worker != null) {
      worker.setLanguage(lng);
    }
  }, [worker]);

  return (
    <I18nProvider onLanguageChange={handleOnLanguageChange}>
      {children}
    </I18nProvider>
  );
}

export function App() {
  return (
    <WorkerProvider>
      <WrappedI18nProvider>
        <LoadingTrigger>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Homepage />} />
            </Routes>
          </BrowserRouter>
        </LoadingTrigger>
      </WrappedI18nProvider>
    </WorkerProvider>
  );
}
