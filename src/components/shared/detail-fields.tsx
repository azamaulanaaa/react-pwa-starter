import type React from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn.ts";

export interface DetailFieldsProps {
  children: ReactNode;
  className?: string;
}

/** Shows a grid of labelled detail values. */
export function DetailFields({
  children,
  className,
}: DetailFieldsProps): React.ReactElement {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2",
        className,
      )}
      data-slot="detail-fields"
    >
      {children}
    </dl>
  );
}

export interface DetailFieldProps {
  label: ReactNode;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}

/** Shows one label and one value. */
export function DetailField({
  label,
  children,
  mono = false,
  className,
}: DetailFieldProps): React.ReactElement {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt
        className="text-muted-foreground text-xs"
        data-slot="detail-field-label"
      >
        {label}
      </dt>
      <dd
        className={cn("text-sm", mono && "font-mono break-all")}
        data-slot="detail-field-value"
      >
        {children}
      </dd>
    </div>
  );
}
