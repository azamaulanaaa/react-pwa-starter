import type React from "react";

import { Badge } from "@/components/ui/badge.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import type { JobState } from "@/worker/queue/schema.ts";

const QUEUE_VARIANTS = {
  queued: "outline",
  running: "info",
  paused: "warning",
  succeeded: "success",
  failed: "error",
  canceled: "outline",
} as const;

export interface QueueStateBadgeProps {
  state: JobState;
}

/** Shows the state of one queue job. */
export function QueueStateBadge({
  state,
}: QueueStateBadgeProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Badge data-slot="queue-state-badge" variant={QUEUE_VARIANTS[state]}>
      {t(`system_state_${state}`)}
    </Badge>
  );
}
