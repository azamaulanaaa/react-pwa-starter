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
  QueueView,
  type QueueViewProps,
} from "@/components/queue/queue-view.tsx";
import type { QueueActionResult } from "@/components/queue/use-queue-jobs.ts";
import type { Job } from "@/worker/queue/schema.ts";

const DICTIONARY = {
  system_action_unavailable: "The worker did not run this action.",
  system_cancel: "Cancel",
  system_cancel_description: "The job stops and cannot start again.",
  system_cancel_keep: "Keep job",
  system_cancel_title: "Cancel this job?",
  system_close: "Close",
  system_copied: "Copied",
  system_copy: "Copy",
  system_copy_id: "Copy ID",
  system_detail_attempt: "Attempt",
  system_detail_created: "Created",
  system_detail_error: "Error",
  system_detail_id: "ID",
  system_detail_kind: "Kind",
  system_detail_no_payload: "No payload.",
  system_detail_no_result: "No result.",
  system_detail_payload: "Payload",
  system_detail_progress: "Progress",
  system_detail_queue_title: "Queue job",
  system_detail_result: "Result",
  system_detail_state: "State",
  system_detail_updated: "Updated",
  system_empty_queue_description: "New jobs appear here.",
  system_empty_queue_title: "No queue jobs",
  system_error_retry: "Try again",
  system_error_title: "The request failed",
  system_filter_all: "All",
  system_filter_state: "Filter state",
  system_pause: "Pause",
  system_queue_description: "Jobs that run in the worker.",
  system_queue_title: "Queue",
  system_refresh: "Refresh",
  system_resume: "Resume",
  system_search_placeholder: "Search id, kind, or path",
  system_showing: "Showing {{shown}} of {{total}}",
  system_state_canceled: "Canceled",
  system_state_failed: "Failed",
  system_state_paused: "Paused",
  system_state_queued: "Queued",
  system_state_running: "Running",
  system_state_succeeded: "Succeeded",
  system_view_details: "View details",
};

function makeJob(
  id: string,
  kind: string,
  state: Job["state"],
  extra: Partial<Job> = {},
): Job {
  return {
    id,
    kind,
    payload: null,
    state,
    progress: 0,
    attempt: 1,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:01:00.000Z",
    result: null,
    error: null,
    ...extra,
  };
}

const JOBS: Job[] = [
  makeJob("job-queued", "task.send", "queued", {
    payload: { name: "queued note" },
  }),
  makeJob("job-running", "task.import", "running", {
    progress: 0.42,
    payload: { file: "items.csv" },
  }),
  makeJob("job-paused", "task.audit", "paused", {
    progress: 0.18,
    payload: { table: "items" },
  }),
  makeJob("job-succeeded", "task.export", "succeeded", {
    progress: 1,
    result: { rows: 128 },
  }),
  makeJob("job-failed", "task.fail", "failed", {
    error: "The file has an invalid row.",
  }),
  makeJob("job-canceled", "task.stop", "canceled"),
];

function accepted(): Promise<QueueActionResult> {
  return Promise.resolve({ ok: true });
}

const BASE_PROPS: QueueViewProps = {
  jobs: JOBS,
  loading: false,
  error: null,
  pendingAction: null,
  onRefresh: () => {},
  onPause: accepted,
  onResume: accepted,
  onCancel: accepted,
};

function renderView(overrides: Partial<QueueViewProps> = {}) {
  return render(
    <TranslationProvider dictionary={DICTIONARY}>
      <IntlProvider>
        <QueueView {...BASE_PROPS} {...overrides} />
      </IntlProvider>
    </TranslationProvider>,
  );
}

describe("QueueView", () => {
  it("shows the state counts and the rows", () => {
    renderView();

    const counts = document.querySelector('[data-slot="queue-counts"]');
    expect(counts).not.toBeNull();
    expect(within(counts as HTMLElement).getAllByText("1")).toHaveLength(6);
    expect(screen.getByText("Showing 6 of 6")).toBeDefined();
    expect(screen.getByText("task.send")).toBeDefined();
    expect(screen.getByText("task.import")).toBeDefined();
  });

  it("keeps the filter compact and the count on one line", () => {
    renderView();

    expect(
      screen.getByLabelText("Filter state").classList.contains("sm:w-44"),
    ).toBe(true);
    expect(
      screen
        .getByText("Showing 6 of 6")
        .classList.contains("whitespace-nowrap"),
    ).toBe(true);
  });

  it("filters the rows by the search text", async () => {
    renderView();

    fireEvent.change(screen.getByLabelText("Search id, kind, or path"), {
      target: { value: "job-failed" },
    });

    await waitFor(() => {
      expect(screen.getAllByLabelText("View details")).toHaveLength(1);
      expect(screen.getByText("task.fail")).toBeDefined();
    });
  });

  it("filters the rows by the state", async () => {
    renderView();

    fireEvent.click(screen.getByLabelText("Filter state"));
    const option = await screen.findByRole("option", { name: "Succeeded" });
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.getAllByLabelText("View details")).toHaveLength(1);
      expect(screen.getByText("task.export")).toBeDefined();
    });
  });

  it("opens the detail sheet with the payload and the progress", async () => {
    renderView();

    fireEvent.click(screen.getAllByLabelText("View details")[1]);

    expect(await screen.findByText("Queue job")).toBeDefined();
    const blocks = document.querySelectorAll('[data-slot="json-view"]');
    expect(blocks[0]?.textContent).toContain('"file": "items.csv"');
    expect(screen.getAllByText("42%")).toHaveLength(2);
  });

  it("calls pause for a queued job", async () => {
    const onPause = vi.fn(accepted);
    renderView({ onPause });

    fireEvent.click(screen.getAllByLabelText("View details")[0]);
    fireEvent.click(await screen.findByText("Pause"));

    await waitFor(() => {
      expect(onPause).toHaveBeenCalledWith("job-queued");
    });
  });

  it("calls resume for a paused job", async () => {
    const onResume = vi.fn(accepted);
    renderView({ onResume });

    fireEvent.click(screen.getAllByLabelText("View details")[2]);
    fireEvent.click(await screen.findByText("Resume"));

    await waitFor(() => {
      expect(onResume).toHaveBeenCalledWith("job-paused");
    });
  });

  it("asks for confirmation before cancel", async () => {
    const onCancel = vi.fn(accepted);
    renderView({ onCancel });

    fireEvent.click(screen.getAllByLabelText("View details")[2]);
    fireEvent.click(await screen.findByText("Cancel"));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Cancel this job?")).toBeDefined();

    fireEvent.click(within(dialog).getByText("Cancel"));

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalledWith("job-paused");
    });
  });

  it("shows a notice when the worker refuses the action", async () => {
    const onPause = vi.fn(async (): Promise<QueueActionResult> => ({
      ok: false,
      reason: "unavailable",
    }));
    renderView({ onPause });

    fireEvent.click(screen.getAllByLabelText("View details")[0]);
    fireEvent.click(await screen.findByText("Pause"));

    expect(
      await screen.findByText("The worker did not run this action."),
    ).toBeDefined();
  });

  it("shows the error alert and retries", () => {
    const onRefresh = vi.fn();
    renderView({ error: new Error("The worker stopped."), onRefresh });

    expect(screen.getByText("The worker stopped.")).toBeDefined();
    fireEvent.click(screen.getByText("Try again"));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows the empty state", () => {
    renderView({ jobs: [] });

    expect(screen.getByText("No queue jobs")).toBeDefined();
    expect(screen.getByText("New jobs appear here.")).toBeDefined();
  });
});
