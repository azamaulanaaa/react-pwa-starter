import { ReactNode, useEffect } from "react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen.ts";

import { useWorker, WorkerProvider } from "@/components/context/worker.tsx";
import { I18nProvider, useI18n } from "@/components/context/i18n.tsx";
import { useSystemDarkMode } from "@/hooks/use-system-dark-mode.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useHtmlLang } from "@/hooks/use-html-lang.ts";

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
      <Spinner />
    </div>
  );
}

function AppInitializerGuard({ children }: { children: ReactNode }) {
  const worker = useWorker();
  const i18n = useI18n();

  if (!worker || !i18n) return <Loading />;

  return (
    <>
      {children}
    </>
  );
}

export function App() {
  const isDarkMode = useSystemDarkMode();
  const locale = useHtmlLang();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <WorkerProvider locale={locale}>
      <I18nProvider locale={locale}>
        <AppInitializerGuard>
          <RouterProvider router={router} />
        </AppInitializerGuard>
      </I18nProvider>
    </WorkerProvider>
  );
}
