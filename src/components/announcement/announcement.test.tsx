// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlProvider } from "@/components/context/intl.tsx";
import { TranslationProvider } from "@/components/context/translation.tsx";
import { AnnouncementHost } from "@/components/announcement/announcement-host.tsx";
import { AnnouncementView } from "@/components/announcement/announcement-view.tsx";
import { ANNOUNCEMENTS } from "@/components/announcement/data.ts";
import {
  EMPTY_DELIVERY,
  SNOOZE_MS,
} from "@/components/announcement/delivery.ts";
import type { AnnouncementDelivery } from "@/components/announcement/types.ts";

import dictionary from "~/public/locales/en-US.json" with { type: "json" };

const STORAGE_KEY = "state-announcement_delivery";
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
    renderWithProviders(
      <AnnouncementView
        announcements={ANNOUNCEMENTS}
        delivery={EMPTY_DELIVERY}
        now={NOW}
        onShow={() => {}}
      />,
    );

    for (const announcement of ANNOUNCEMENTS) {
      expect(screen.getByText(announcement.title)).toBeDefined();
      expect(screen.getByText(announcement.body)).toBeDefined();
    }
  });

  it("opens the detail sheet and shows the announcement with each presentation", () => {
    const onShow = vi.fn();

    renderWithProviders(
      <AnnouncementView
        announcements={ANNOUNCEMENTS}
        delivery={EMPTY_DELIVERY}
        now={NOW}
        onShow={onShow}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", {
        name: dictionary.system_view_details,
      })[0],
    );

    expect(
      screen.getByRole("dialog", { name: ANNOUNCEMENTS[0].title }),
    ).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", {
        name: dictionary.system_announcements_show_dialog,
      }),
    );

    expect(onShow).toHaveBeenCalledWith(ANNOUNCEMENTS[0].id, "dialog");

    fireEvent.click(
      screen.getAllByRole("button", {
        name: dictionary.system_view_details,
      })[0],
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: dictionary.system_announcements_show_banner,
      }),
    );

    expect(onShow).toHaveBeenCalledWith(ANNOUNCEMENTS[0].id, "banner");
  });

  it("truncates the content and hides the secondary columns below sm", () => {
    renderWithProviders(
      <AnnouncementView
        announcements={ANNOUNCEMENTS}
        delivery={EMPTY_DELIVERY}
        now={NOW}
        onShow={() => {}}
      />,
    );

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
    renderWithProviders(
      <AnnouncementView
        announcements={[]}
        delivery={EMPTY_DELIVERY}
        now={NOW}
        onShow={() => {}}
      />,
    );

    expect(
      screen.getByText(dictionary.system_announcements_empty_title),
    ).toBeDefined();
    expect(
      screen.getByText(dictionary.system_announcements_empty_description),
    ).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
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
