import type React from "react";

import { QueueView } from "@/components/system/queue-view.tsx";
import { useQueueJobs } from "@/components/system/use-queue-jobs.ts";

/** Connects the queue view to the worker. */
export function QueuePanel(): React.ReactElement {
  const {
    jobs,
    loading,
    error,
    pendingAction,
    refresh,
    pause,
    resume,
    cancel,
  } = useQueueJobs();

  return (
    <QueueView
      error={error}
      jobs={jobs}
      loading={loading}
      onCancel={cancel}
      onPause={pause}
      onRefresh={() => void refresh()}
      onResume={resume}
      pendingAction={pendingAction}
    />
  );
}
