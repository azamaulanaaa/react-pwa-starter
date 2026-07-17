import { ReactNode, useCallback, useEffect } from "react";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen.ts";

import { useWorker, WorkerProvider } from "@/components/worker_context.tsx";
import { I18nProvider, useI18n } from "@/components/i18n_context.tsx";
import { useSystemDarkMode } from "@/hooks/use-system-dark-mode.ts";
import { Spinner } from "@/components/ui/spinner.tsx";

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

function WrappedI18nProvider({ children }: { children: ReactNode }) {
  const worker = useWorker();

  const handleOnLanguageChange = useCallback((lng: string) => {
    if (worker != null) {
      worker.i18n.changeLanguage(lng);
    }
  }, [worker]);

  return (
    <I18nProvider onLanguageChange={handleOnLanguageChange}>
      {children}
    </I18nProvider>
  );
}

export function App() {
  const isDarkMode = useSystemDarkMode();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <WorkerProvider>
      <WrappedI18nProvider>
        <AppInitializerGuard>
          <RouterProvider router={router} />
        </AppInitializerGuard>
      </WrappedI18nProvider>
    </WorkerProvider>
  );
}
