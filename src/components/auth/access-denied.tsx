import type * as React from "react";
import { ShieldXIcon } from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils/cn.ts";

export interface AccessDeniedProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  onSignIn?: () => void;
  className?: string;
}

export function AccessDenied({
  title,
  description,
  onRetry,
  onSignIn,
  className,
}: AccessDeniedProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Empty className={cn(className)} data-slot="access-denied">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldXIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title ?? t("auth_access_denied_title")}</EmptyTitle>
        <EmptyDescription>
          {description ?? t("auth_access_denied_description")}
        </EmptyDescription>
      </EmptyHeader>
      {(onRetry || onSignIn) && (
        <EmptyContent>
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              {t("auth_retry")}
            </Button>
          )}
          {onSignIn && (
            <Button onClick={onSignIn} variant="ghost">
              {t("auth_sign_in")}
            </Button>
          )}
        </EmptyContent>
      )}
    </Empty>
  );
}
