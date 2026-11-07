// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import { SystemPage } from "@/components/system/system-page.tsx";

vi.mock("@/components/system/outbox-panel.tsx", () => ({
  OutboxPanel: () => <div>Outbox panel</div>,
}));

vi.mock("@/components/system/queue-panel.tsx", () => ({
  QueuePanel: () => <div>Queue panel</div>,
}));

const DICTIONARY = {
  page_dashboard_system_description: "Review outbox writes and queue jobs.",
  page_dashboard_system_title: "System",
  system_tab_outbox: "Outbox",
  system_tab_queue: "Queue",
};

function renderPage() {
  return render(
    <TranslationProvider dictionary={DICTIONARY}>
      <IntlProvider>
        <SystemPage />
      </IntlProvider>
    </TranslationProvider>,
  );
}

describe("SystemPage", () => {
  it("shows the outbox tab first", () => {
    renderPage();

    expect(screen.getByText("System")).toBeDefined();
    expect(
      screen.getByText("Review outbox writes and queue jobs."),
    ).toBeDefined();
    expect(screen.getByText("Outbox panel")).toBeDefined();
    expect(
      screen.getByRole("tab", { name: "Outbox" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("switches between the outbox and the queue tabs", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Queue" }));

    expect(
      screen.getByRole("tab", { name: "Queue" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText("Queue panel")).toBeDefined();

    fireEvent.click(screen.getByRole("tab", { name: "Outbox" }));

    expect(
      screen.getByRole("tab", { name: "Outbox" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText("Outbox panel")).toBeDefined();
  });
});
