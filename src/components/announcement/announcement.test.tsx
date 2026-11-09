// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import { AnnouncementHost } from "@/components/announcement/announcement-host.tsx";
import { AnnouncementPanel } from "@/components/announcement/announcement-panel.tsx";
import { AnnouncementView } from "@/components/announcement/announcement-view.tsx";
import { ANNOUNCEMENTS } from "@/components/announcement/data.ts";
import {
  EMPTY_DELIVERY,
  SNOOZE_MS,
} from "@/components/announcement/delivery.ts";
import type {
  Announcement,
  AnnouncementDelivery,
} from "@/components/announcement/types.ts";

import dictionary from "~/public/locales/en-US.json" with { type: "json" };

const STORAGE_KEY = "state-announcement_delivery";
const CATALOG_KEY = "state-announcement_catalog";
const NOW = 1_700_000_000_000;

function Providers({ children }: { children: ReactNode }) {
  return (
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      <IntlProvider locale="en-US">{children}</IntlProvider>
    </TranslationProvider>
  );
}

function renderWithProviders(ui: ReactNode) {
  return render(<Providers>{ui}</Providers>);
}

function renderView({
  announcements = ANNOUNCEMENTS,
}: {
  announcements?: Announcement[];
} = {}) {
  return renderWithProviders(
    <AnnouncementView
      announcements={announcements}
      delivery={EMPTY_DELIVERY}
      now={NOW}
    />,
  );
}

function seedDelivery(delivery: AnnouncementDelivery): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(delivery));
}

function readDelivery(): AnnouncementDelivery {
  return JSON.parse(
    localStorage.getItem(STORAGE_KEY) ?? "{}",
  ) as AnnouncementDelivery;
}

describe("AnnouncementView", () => {
  it("shows every announcement in the table", () => {
    renderView();

    for (const announcement of ANNOUNCEMENTS) {
      expect(screen.getByText(announcement.title)).toBeDefined();
      expect(screen.getByText(announcement.body)).toBeDefined();
    }
  });

  it("opens the detail sheet with the full announcement and no show actions", () => {
    renderView();

    fireEvent.click(
      screen.getAllByRole("button", {
        name: dictionary.system_view_details,
      })[0],
    );

    const dialog = screen.getByRole("dialog", {
      name: ANNOUNCEMENTS[0].title,
    });

    expect(within(dialog).getByText(ANNOUNCEMENTS[0].body)).toBeDefined();
    expect(
      within(dialog).queryByRole("button", { name: "Show lightbox" }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: "Show banner" }),
    ).toBeNull();
  });

  it("truncates the content and hides the secondary columns below sm", () => {
    renderView();

    expect(screen.getByRole("table").className).toContain("table-fixed");

    const contentCell = screen.getByText(ANNOUNCEMENTS[0].title).closest("td");
    const actionCell = screen
      .getAllByRole("button", { name: dictionary.system_view_details })[0]
      .closest("td");

    expect(contentCell?.className).toContain("max-w-0");
    expect(actionCell?.className).toContain("w-12");
    expect(
      screen.getByRole("columnheader", { name: dictionary.system_actions })
        .className,
    ).toContain("w-12");
    expect(screen.getByText(ANNOUNCEMENTS[0].title).className).toContain(
      "truncate",
    );
    expect(screen.getByText(ANNOUNCEMENTS[0].body).className).toContain(
      "truncate",
    );

    for (const name of [
      dictionary.system_announcements_column_variant,
      dictionary.system_announcements_column_status,
    ]) {
      const header = screen.getByRole("columnheader", { name });

      expect(header.className).toContain("hidden");
      expect(header.className).toContain("sm:table-cell");
    }
  });

  it("shows the empty state when the catalog is empty", () => {
    renderView({ announcements: [] });

    expect(
      screen.getByText(dictionary.system_announcements_empty_title),
    ).toBeDefined();
    expect(
      screen.getByText(dictionary.system_announcements_empty_description),
    ).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("AnnouncementPanel", () => {
  beforeEach(() => {
    localStorage.removeItem(CATALOG_KEY);
    localStorage.removeItem(STORAGE_KEY);
  });

  it("shows a custom announcement in the read-only history", () => {
    const custom: Announcement = {
      id: "custom-notice",
      title: "Custom notice",
      body: "Custom body text.",
      variant: "info",
      preferredPresentation: "banner",
    };

    localStorage.setItem(CATALOG_KEY, JSON.stringify([custom]));

    renderWithProviders(<AnnouncementPanel />);

    expect(screen.getByText("Custom notice")).toBeDefined();
    expect(
      screen.queryByRole("button", {
        name: dictionary.system_announcements_form_submit,
      }),
    ).toBeNull();
  });
});

describe("AnnouncementHost", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the banner with a status role and a hide action", () => {
    const announcement = ANNOUNCEMENTS[1];

    seedDelivery({
      activeId: announcement.id,
      presentation: "banner",
      snoozedUntil: {},
      dismissed: [],
    });

    renderWithProviders(<AnnouncementHost />);

    const status = screen.getByRole("status");

    expect(status.textContent).toContain(announcement.title);
    expect(status.textContent).toContain(announcement.body);
    expect(
      screen.getByRole("button", {
        name: dictionary.announcement_hide_for_later,
      }),
    ).toBeDefined();
  });

  it("hides the banner for later", () => {
    const announcement = ANNOUNCEMENTS[1];

    seedDelivery({
      activeId: announcement.id,
      presentation: "banner",
      snoozedUntil: {},
      dismissed: [],
    });

    renderWithProviders(<AnnouncementHost />);

    fireEvent.click(
      screen.getByRole("button", {
        name: dictionary.announcement_hide_for_later,
      }),
    );

    expect(readDelivery().snoozedUntil[announcement.id]).toBeGreaterThan(
      Date.now() + SNOOZE_MS - 1000,
    );
  });

  it("shows the dialog title and body", () => {
    const announcement = ANNOUNCEMENTS[0];

    seedDelivery({
      activeId: announcement.id,
      presentation: "dialog",
      snoozedUntil: {},
      dismissed: [],
    });

    renderWithProviders(<AnnouncementHost />);

    expect(
      screen.getByRole("dialog", { name: announcement.title }),
    ).toBeDefined();
    expect(screen.getByText(announcement.body)).toBeDefined();
  });

  it("dismisses the dialog from the Got it action", () => {
    const announcement = ANNOUNCEMENTS[0];

    seedDelivery({
      activeId: announcement.id,
      presentation: "dialog",
      snoozedUntil: {},
      dismissed: [],
    });

    renderWithProviders(<AnnouncementHost />);

    fireEvent.click(
      screen.getByRole("button", { name: dictionary.announcement_got_it }),
    );

    const delivery = readDelivery();

    expect(delivery.activeId).toBeNull();
    expect(delivery.dismissed).toContain(announcement.id);
  });

  it("hides the dialog for later", () => {
    const announcement = ANNOUNCEMENTS[0];

    seedDelivery({
      activeId: announcement.id,
      presentation: "dialog",
      snoozedUntil: {},
      dismissed: [],
    });

    renderWithProviders(<AnnouncementHost />);

    fireEvent.click(
      screen.getByRole("button", {
        name: dictionary.announcement_hide_for_later,
      }),
    );

    const delivery = readDelivery();

    expect(delivery.activeId).toBe(announcement.id);
    expect(delivery.presentation).toBe("dialog");
    expect(delivery.snoozedUntil[announcement.id]).toBeGreaterThan(Date.now());
  });
});
