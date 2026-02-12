import { ReactNode, useCallback } from "react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import "./app.css";
import { syncZodLocale } from "./lib/zod.ts";
import { routeTree } from "./routeTree.gen.ts";

import { useWorker, WorkerProvider } from "./component/worker_context.tsx";
import { I18nProvider, useI18n } from "./component/i18n_context.tsx";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

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
          <RouterProvider router={router} />
        </LoadingTrigger>
      </WrappedI18nProvider>
    </WorkerProvider>
  );
}
