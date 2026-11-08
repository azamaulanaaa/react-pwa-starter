import type { Story, StoryDefault } from "@ladle/react";

import {
  QueueView as QueueViewComponent,
  type QueueViewProps,
} from "@/components/queue/queue-view.tsx";
import type { Job } from "@/worker/queue/schema.ts";

const QUEUE_JOBS: Job[] = [
  {
    id: "job-queued",
    kind: "example.task.export",
    payload: { format: "csv", range: "last-30-days" },
    state: "queued",
    progress: 0,
    attempt: 1,
    created_at: "2026-01-12T08:30:00.000Z",
    updated_at: "2026-01-12T08:30:00.000Z",
    result: null,
    error: null,
  },
  {
    id: "job-running",
    kind: "example.task.import",
    payload: { file: "items.csv" },
    state: "running",
    progress: 0.42,
    attempt: 1,
    created_at: "2026-01-12T08:31:00.000Z",
    updated_at: "2026-01-12T08:31:20.000Z",
    result: null,
    error: null,
  },
  {
    id: "job-paused",
    kind: "example.task.audit",
    payload: { table: "items" },
    state: "paused",
    progress: 0.18,
    attempt: 2,
    created_at: "2026-01-12T08:32:00.000Z",
    updated_at: "2026-01-12T08:32:30.000Z",
    result: null,
    error: null,
  },
  {
    id: "job-succeeded",
    kind: "example.task.export",
    payload: { format: "json", range: "today" },
    state: "succeeded",
    progress: 1,
    attempt: 1,
    created_at: "2026-01-12T08:33:00.000Z",
    updated_at: "2026-01-12T08:33:40.000Z",
    result: { rows: 128, file: "export.json" },
    error: null,
  },
  {
    id: "job-failed",
    kind: "example.task.import",
    payload: { file: "broken.csv" },
    state: "failed",
    progress: 0.6,
    attempt: 3,
    created_at: "2026-01-12T08:34:00.000Z",
    updated_at: "2026-01-12T08:34:50.000Z",
    result: null,
    error: "The file has an invalid row on line 12.",
  },
  {
    id: "job-canceled",
    kind: "example.task.audit",
    payload: { table: "users" },
    state: "canceled",
    progress: 0.05,
    attempt: 1,
    created_at: "2026-01-12T08:35:00.000Z",
    updated_at: "2026-01-12T08:35:10.000Z",
    result: null,
    error: null,
  },
];

function noop(): void {}

function accepted(): Promise<{ ok: true }> {
  return Promise.resolve({ ok: true });
}

const QUEUE_PROPS: QueueViewProps = {
  jobs: QUEUE_JOBS,
  loading: false,
  refreshing: false,
  error: null,
  pendingAction: null,
  onRefresh: noop,
  onPause: accepted,
  onResume: accepted,
  onCancel: accepted,
};

const EMPTY_QUEUE_PROPS: QueueViewProps = {
  ...QUEUE_PROPS,
  jobs: [],
};

export default {
  title: "Queue",
} as StoryDefault;

export const QueueView: Story = () => <QueueViewComponent {...QUEUE_PROPS} />;

export const QueueViewEmpty: Story = () => (
  <QueueViewComponent {...EMPTY_QUEUE_PROPS} />
);
