import type * as React from "react";
import {
  createRootRoute,
  Link,
  Outlet,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { CompassIcon, TriangleAlertIcon } from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";

function NotFoundPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CompassIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("app_not_found_title")}</EmptyTitle>
          <EmptyDescription>{t("app_not_found_description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/" />}>{t("app_go_home")}</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function ErrorPage({ error, reset }: ErrorComponentProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Alert variant="error">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>{t("app_error_title")}</AlertTitle>
          <AlertDescription>
            <p>{t("app_error_description")}</p>
            {error instanceof Error && error.message && (
              <p className="font-mono text-xs break-all">{error.message}</p>
            )}
          </AlertDescription>
          <AlertAction>
            <Button onClick={reset} size="sm" variant="outline">
              {t("app_error_retry")}
            </Button>
          </AlertAction>
        </Alert>
      </div>
    </div>
  );
}

const RootLayout = () => (
  <>
    <Outlet />
    <TanStackRouterDevtools />
  </>
);

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
});
