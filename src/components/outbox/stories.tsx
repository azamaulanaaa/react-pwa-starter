import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  OutboxView as OutboxViewComponent,
  type OutboxViewProps,
} from "@/components/outbox/outbox-view.tsx";
import type { OutboxOp, OutboxStatus } from "@/lib/outbox/types.ts";

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

function noop(): void {}

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
  onDismissFlushResult: noop,
};

const EMPTY_OUTBOX_PROPS: OutboxViewProps = {
  ...OUTBOX_PROPS,
  ops: [],
  status: EMPTY_OUTBOX_STATUS,
};

const meta = {
  title: "Outbox",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const OutboxView: Story = {
  render: () => <OutboxViewComponent {...OUTBOX_PROPS} />,
};

export const OutboxViewEmpty: Story = {
  render: () => <OutboxViewComponent {...EMPTY_OUTBOX_PROPS} />,
};
