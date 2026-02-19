import { ReactNode, useEffect } from "react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import "./app.css";
import { syncZodLocale } from "./lib/zod.ts";
import { routeTree } from "./routeTree.gen.ts";

import { useWorker, WorkerProvider } from "./component/worker_context.tsx";
import { I18nProvider, useI18n } from "./component/i18n_context.tsx";
import { AppState, useAppState } from "./state.ts";
import { cn } from "./lib/cn.ts";
import { useSystemTheme } from "./hook/useSystemTheme.ts";

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

  const changeLanguage = (language: AppState["language"]) => {
    if (!worker || !i18n) return;

    syncZodLocale(language);
    worker.setLanguage(language);
    i18n.changeLanguage(language);
    document.documentElement.lang = language;
  };

  useEffect(() => {
    if (!worker || !i18n) return;

    const currentLang = useAppState.getState().language;
    changeLanguage(currentLang);

    const unsubscribe = useAppState.subscribe((state, prevState) => {
      if (state.language !== prevState.language) {
        changeLanguage(state.language);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [worker, i18n]);

  if (!worker || !i18n) return <Loading />;

  return (
    <>
      {children}
    </>
  );
}

export function App() {
  const theme = useAppState((state) => state.theme);
  const systemTheme = useSystemTheme();

  const isThemeDark = theme == "dark" ||
    (theme == "system" && systemTheme == "dark");

  return (
    <div className={cn([isThemeDark, "dark"])}>
      <WorkerProvider>
        <I18nProvider>
          <LoadingTrigger>
            <RouterProvider router={router} />
          </LoadingTrigger>
        </I18nProvider>
      </WorkerProvider>
    </div>
  );
}
