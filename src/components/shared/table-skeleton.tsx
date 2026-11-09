import type React from "react";

import { cn } from "@/lib/utils/cn.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/**
 * Shows placeholder rows that mirror the table geometry.
 * The region is marked busy for assistive technology.
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: TableSkeletonProps): React.ReactElement {
  const cells = Array.from({ length: columns }, (_, index) => index);

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border",
        className,
      )}
      data-slot="table-skeleton"
    >
      <div className="flex h-10 items-center gap-4 border-b bg-muted/40 px-2.5">
        {cells.map((cell) => (
          <Skeleton
            className={cn("h-3", cell === 0 ? "w-14" : "flex-1")}
            key={`head-${cell}`}
          />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          className="flex h-10 items-center gap-4 border-b px-2.5 last:border-b-0"
          key={`row-${row}`}
        >
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
