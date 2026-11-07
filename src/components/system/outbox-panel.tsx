import type React from "react";

import { OutboxView } from "@/components/system/outbox-view.tsx";
import { useOutboxOps } from "@/components/system/use-outbox-ops.ts";

/** Connects the outbox view to the worker. */
export function OutboxPanel(): React.ReactElement {
  const { refresh, flush, resume, ...result } = useOutboxOps();

  return (
    <OutboxView
      {...result}
      onFlush={() => void flush()}
      onRefresh={() => void refresh()}
      onResume={() => void resume()}
    />
  );
}
