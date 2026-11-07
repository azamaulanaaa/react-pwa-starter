import type { Story, StoryDefault } from "@ladle/react";

import {
  OutboxView as OutboxViewComponent,
  type OutboxViewProps,
} from "@/components/system/outbox-view.tsx";
import {
  QueueView as QueueViewComponent,
  type QueueViewProps,
} from "@/components/system/queue-view.tsx";
import type { OutboxOp, OutboxStatus } from "@/lib/outbox/types.ts";
import type { Job } from "@/worker/queue/schema.ts";

const CREATED_AT = Date.UTC(2026, 0, 12, 8, 30);
const NEXT_ATTEMPT_AT = Date.UTC(2026, 0, 12, 8, 35);

const OUTBOX_OPS: OutboxOp[] = [
  {
    id: "018f0a0a-0000-7000-8000-000000000001",
    kind: "example.write.create",
    method: "POST",
    path: "/api/example/items",
    body: { name: "Field note", quantity: 2 },
    createdAt: CREATED_AT,
    attempts: 0,
    nextAttemptAt: CREATED_AT,
    state: "pending",
  },
  {
    id: "018f0a0a-0000-7000-8000-000000000002",
    kind: "example.write.update",
    method: "PATCH",
    path: "/api/example/items/item-1",
    body: { name: "Field note", quantity: 3 },
    createdAt: CREATED_AT + 1000,
    attempts: 1,
    nextAttemptAt: NEXT_ATTEMPT_AT,
    state: "sending",
  },
  {
    id: "018f0a0a-0000-7000-8000-000000000003",
    kind: "example.write.remove",
    method: "DELETE",
    path: "/api/example/items/item-2",
    body: null,
    createdAt: CREATED_AT + 2000,
    attempts: 3,
    nextAttemptAt: NEXT_ATTEMPT_AT,
    state: "failed",
    lastError: {
      code: "invalid_request",
      message: "The server rejected the request body.",
    },
  },
  {
    id: "018f0a0a-0000-7000-8000-000000000004",
    kind: "example.write.update",
    method: "PUT",
    path: "/api/example/items/item-3",
    body: { name: "Edited note", quantity: 1 },
    createdAt: CREATED_AT + 3000,
    attempts: 2,
    nextAttemptAt: NEXT_ATTEMPT_AT,
    state: "conflict",
    lastError: {
      code: "version_conflict",
      message: "The server has a newer version of this item.",
    },
  },
];

const OUTBOX_STATUS: OutboxStatus = {
  pending: 1,
  sending: 1,
  failed: 1,
  conflict: 1,
  paused: false,
  signInRequired: false,
};

const EMPTY_OUTBOX_STATUS: OutboxStatus = {
  pending: 0,
  sending: 0,
  failed: 0,
  conflict: 0,
  paused: false,
  signInRequired: false,
};

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

const OUTBOX_PROPS: OutboxViewProps = {
  ops: OUTBOX_OPS,
  status: OUTBOX_STATUS,
  loading: false,
  refreshing: false,
  error: null,
  flushing: false,
  resuming: false,
  flushResult: null,
  onRefresh: noop,
  onFlush: noop,
  onResume: noop,
};

const EMPTY_OUTBOX_PROPS: OutboxViewProps = {
  ...OUTBOX_PROPS,
  ops: [],
  status: EMPTY_OUTBOX_STATUS,
};

const QUEUE_PROPS: QueueViewProps = {
  jobs: QUEUE_JOBS,
  loading: false,
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
  title: "System",
} as StoryDefault;

export const OutboxView: Story = () => (
  <OutboxViewComponent {...OUTBOX_PROPS} />
);

export const OutboxViewEmpty: Story = () => (
  <OutboxViewComponent {...EMPTY_OUTBOX_PROPS} />
);

export const QueueView: Story = () => <QueueViewComponent {...QUEUE_PROPS} />;

export const QueueViewEmpty: Story = () => (
  <QueueViewComponent {...EMPTY_QUEUE_PROPS} />
);
