import type * as React from "react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils/cn.ts";

export interface AuthLoadingProps {
  label?: string;
  className?: string;
}

export function AuthLoading({
  label,
  className,
}: AuthLoadingProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className,
      )}
      data-slot="auth-loading"
      role="status"
    >
      <Spinner className="size-5" />
      <span className="text-muted-foreground text-sm">
        {label ?? t("auth_loading")}
      </span>
    </div>
  );
}
