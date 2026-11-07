import type * as React from "react";

import { cn } from "@/lib/utils/cn.ts";

export interface AuthShellProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthShell({
  children,
  footer,
  className,
}: AuthShellProps): React.ReactElement {
  return (
    <div
      className={cn(
        "flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-background px-4 py-10",
        className,
      )}
      data-slot="auth-shell"
    >
      {children}
      {footer}
    </div>
  );
}
