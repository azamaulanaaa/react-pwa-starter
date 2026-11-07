// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import {
  OutboxView,
  type OutboxViewProps,
} from "@/components/system/outbox-view.tsx";
import type { OutboxOp, OutboxStatus } from "@/lib/outbox/types.ts";

const DICTIONARY = {
  system_action_unavailable: "The worker did not run this action.",
  system_close: "Close",
  system_copied: "Copied",
  system_copy: "Copy",
  system_copy_id: "Copy ID",
  system_detail_attempts: "Attempts",
  system_detail_body: "Body",
  system_detail_created: "Created",
  system_detail_id: "ID",
  system_detail_kind: "Kind",
  system_detail_last_error: "Last error",
  system_detail_method: "Method",
  system_detail_next_attempt: "Next attempt",
  system_detail_no_body: "No body.",
  system_detail_outbox_title: "Outbox operation",
  system_detail_path: "Path",
  system_detail_state: "State",
  system_empty_outbox_description: "New writes appear here.",
  system_empty_outbox_title: "No outbox writes",
  system_error_retry: "Try again",
  system_error_title: "The request failed",
  system_filter_all: "All",
  system_filter_state: "Filter state",
  system_flush: "Flush now",
  system_flush_result:
    "Sent {{sent}}. Pending {{pending}}. Failed {{failed}}. Conflict {{conflict}}.",
  system_outbox_description: "Durable writes that wait for a send.",
  system_outbox_paused: "The outbox is paused.",
  system_outbox_sign_in: "Sign in",
  system_outbox_sign_in_required: "The session expired.",
  system_outbox_title: "Outbox",
  system_refresh: "Refresh",
  system_resume: "Resume",
  system_search_placeholder: "Search id, kind, or path",
  system_showing: "Showing {{shown}} of {{total}}",
  system_state_conflict: "Conflict",
  system_state_done: "Done",
  system_state_failed: "Failed",
  system_state_pending: "Pending",
  system_state_sending: "Sending",
  system_view_details: "View details",
};

const PENDING: OutboxOp = {
  id: "op-1",
  kind: "note.create",
  method: "POST",
  path: "/api/notes",
  body: { name: "Note" },
  createdAt: Date.UTC(2026, 0, 1, 10, 0),
  attempts: 0,
  nextAttemptAt: Date.UTC(2026, 0, 1, 10, 0),
  state: "pending",
};

const SENDING: OutboxOp = {
  id: "op-2",
  kind: "note.update",
  method: "PATCH",
  path: "/api/notes/2",
  body: { name: "Edited note" },
  createdAt: Date.UTC(2026, 0, 1, 10, 1),
  attempts: 1,
  nextAttemptAt: Date.UTC(2026, 0, 1, 10, 2),
  state: "sending",
};

const FAILED: OutboxOp = {
  id: "op-3",
  kind: "note.remove",
  method: "DELETE",
  path: "/api/notes/3",
  body: null,
  createdAt: Date.UTC(2026, 0, 1, 10, 2),
  attempts: 3,
  nextAttemptAt: Date.UTC(2026, 0, 1, 10, 3),
  state: "failed",
  lastError: {
    code: "invalid_note",
    message: "The server rejected the note.",
  },
};

const STATUS: OutboxStatus = {
  pending: 1,
  sending: 1,
  failed: 1,
  conflict: 0,
  paused: false,
  signInRequired: false,
};

const BASE_PROPS: OutboxViewProps = {
  ops: [PENDING, SENDING, FAILED],
  status: STATUS,
  loading: false,
  refreshing: false,
  error: null,
  flushing: false,
  resuming: false,
  flushResult: null,
  onRefresh: () => {},
  onFlush: () => {},
  onResume: () => {},
};

function renderView(overrides: Partial<OutboxViewProps> = {}) {
  return render(
    <TranslationProvider dictionary={DICTIONARY}>
      <IntlProvider>
        <OutboxView {...BASE_PROPS} {...overrides} />
      </IntlProvider>
    </TranslationProvider>,
  );
}

describe("OutboxView", () => {
  it("shows the state counts and the rows", () => {
    renderView();

    const counts = document.querySelector('[data-slot="outbox-counts"]');
    expect(counts).not.toBeNull();
    expect(within(counts as HTMLElement).getAllByText("1")).toHaveLength(3);

    expect(screen.getByText("/api/notes")).toBeDefined();
    expect(screen.getByText("/api/notes/2")).toBeDefined();
    expect(screen.getByText("/api/notes/3")).toBeDefined();
    expect(screen.getByText("note.create")).toBeDefined();
  });

  it("filters the rows by the search text", async () => {
    renderView();

    fireEvent.change(screen.getByLabelText("Search id, kind, or path"), {
      target: { value: "notes/2" },
    });

    await waitFor(() => {
      expect(screen.queryByText("/api/notes/2")).not.toBeNull();
      expect(screen.queryByText("/api/notes")).toBeNull();
    });
  });

  it("filters the rows by the state", async () => {
    renderView();

    fireEvent.click(screen.getByLabelText("Filter state"));
    const option = await screen.findByRole("option", { name: "Failed" });
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.queryByText("/api/notes/3")).not.toBeNull();
      expect(screen.queryByText("/api/notes")).toBeNull();
      expect(screen.queryByText("/api/notes/2")).toBeNull();
    });
  });

  it("opens the detail sheet with the body", async () => {
    renderView();

    fireEvent.click(screen.getAllByLabelText("View details")[0]);

    expect(await screen.findByText("Outbox operation")).toBeDefined();
    const body = document.querySelector('[data-slot="json-view"]');
    expect(body?.textContent).toContain('"name": "Note"');
  });

  it("calls the flush callback", () => {
    const onFlush = vi.fn();
    renderView({ onFlush });

    fireEvent.click(screen.getByText("Flush now"));

    expect(onFlush).toHaveBeenCalledOnce();
  });

  it("calls the resume callback", () => {
    const onResume = vi.fn();
    renderView({
      onResume,
      status: { ...STATUS, paused: true },
    });

    fireEvent.click(screen.getAllByText("Resume")[0]);

    expect(onResume).toHaveBeenCalledOnce();
  });

  it("shows the error alert and retries", () => {
    const onRefresh = vi.fn();
    renderView({
      error: new Error("The worker stopped."),
      onRefresh,
    });

    expect(screen.getByText("The worker stopped.")).toBeDefined();
    fireEvent.click(screen.getByText("Try again"));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows the empty state", () => {
    renderView({
      ops: [],
      status: {
        pending: 0,
        sending: 0,
        failed: 0,
        conflict: 0,
        paused: false,
        signInRequired: false,
      },
    });

    expect(screen.getByText("No outbox writes")).toBeDefined();
    expect(screen.getByText("New writes appear here.")).toBeDefined();
  });
});
