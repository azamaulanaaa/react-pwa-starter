import type React from "react";

import { Badge } from "@/components/ui/badge.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import type { OutboxMethod, OutboxState } from "@/lib/outbox/types.ts";

const OUTBOX_VARIANTS = {
  pending: "warning",
  sending: "info",
  failed: "error",
  conflict: "warning",
  done: "success",
} as const;

export interface OutboxStateBadgeProps {
  state: OutboxState;
}

/** Shows the state of one outbox operation. */
export function OutboxStateBadge({
  state,
}: OutboxStateBadgeProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Badge data-slot="outbox-state-badge" variant={OUTBOX_VARIANTS[state]}>
      {t(`system_state_${state}`)}
    </Badge>
  );
}

export interface MethodBadgeProps {
  method: OutboxMethod;
}

/** Shows the HTTP method of one outbox operation. */
export function MethodBadge({ method }: MethodBadgeProps): React.ReactElement {
  return (
    <Badge
      className="font-mono"
      data-slot="method-badge"
      size="sm"
      variant="outline"
    >
      {method}
    </Badge>
  );
}
