import { ReactNode, useEffect } from "react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import "./app.css";
import { syncZodLocale } from "./lib/zod.ts";
import { routeTree } from "./routeTree.gen.ts";

import { useWorker, WorkerProvider } from "./component/worker_context.tsx";
import { I18nProvider, useI18n } from "./component/i18n_context.tsx";
import { useAppState } from "./state.ts";

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
  const language = useAppState((s) => s.language);

  useEffect(() => {
    if (!worker || !i18n) return;

    syncZodLocale(language);
    worker.setLanguage(language);
    i18n.changeLanguage(language);
  }, [language, worker, i18n]);

  if (!worker || !i18n) return <Loading />;

  return (
    <>
      {children}
    </>
  );
}

export function App() {
  return (
    <WorkerProvider>
      <I18nProvider>
        <LoadingTrigger>
          <RouterProvider router={router} />
        </LoadingTrigger>
      </I18nProvider>
    </WorkerProvider>
  );
}
