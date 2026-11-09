import { describe, expect, it } from "vitest";

import { ANNOUNCEMENTS } from "@/components/announcement/data.ts";
import {
  EMPTY_DELIVERY,
  SNOOZE_MS,
  dismissAnnouncement,
  getAnnouncementStatus,
  getVisibleAnnouncement,
  hideForLater,
  showAnnouncement,
} from "@/components/announcement/delivery.ts";

const NOW = 1_700_000_000_000;
const ANNOUNCEMENT_ID = ANNOUNCEMENTS[0].id;

describe("announcement delivery", () => {
  it("shows an announcement with the selected presentation", () => {
    const state = showAnnouncement(
      EMPTY_DELIVERY,
      ANNOUNCEMENT_ID,
      "dialog",
      NOW,
    );

    expect(state).toEqual({
      activeId: ANNOUNCEMENT_ID,
      presentation: "dialog",
      snoozedUntil: {},
      dismissed: [],
    });
  });

  it("clears the snooze and the dismissal when it shows again", () => {
    const hidden = {
      activeId: null,
      presentation: null,
      snoozedUntil: { [ANNOUNCEMENT_ID]: NOW + SNOOZE_MS },
      dismissed: [ANNOUNCEMENT_ID],
    };

    const state = showAnnouncement(hidden, ANNOUNCEMENT_ID, "banner", NOW);

    expect(state.activeId).toBe(ANNOUNCEMENT_ID);
    expect(state.presentation).toBe("banner");
    expect(state.snoozedUntil[ANNOUNCEMENT_ID]).toBeUndefined();
    expect(state.dismissed).toEqual([]);
  });

  it("hides an announcement for 24 hours", () => {
    const shown = showAnnouncement(
      EMPTY_DELIVERY,
      ANNOUNCEMENT_ID,
      "dialog",
      NOW,
    );

    const state = hideForLater(shown, ANNOUNCEMENT_ID, NOW);

    expect(state.activeId).toBe(ANNOUNCEMENT_ID);
    expect(state.presentation).toBe("dialog");
    expect(state.snoozedUntil[ANNOUNCEMENT_ID]).toBe(NOW + SNOOZE_MS);
    expect(getAnnouncementStatus(state, ANNOUNCEMENT_ID, NOW)).toBe("snoozed");
  });

  it("shows the announcement again when the snooze ends", () => {
    const shown = showAnnouncement(
      EMPTY_DELIVERY,
      ANNOUNCEMENT_ID,
      "dialog",
      NOW,
    );
    const state = hideForLater(shown, ANNOUNCEMENT_ID, NOW);

    expect(getAnnouncementStatus(state, ANNOUNCEMENT_ID, NOW + SNOOZE_MS)).toBe(
      "visible",
    );
    expect(
      getVisibleAnnouncement(state, ANNOUNCEMENTS, NOW + SNOOZE_MS)
        ?.announcement.id,
    ).toBe(ANNOUNCEMENT_ID);
  });

  it("dismisses the active announcement", () => {
    const shown = showAnnouncement(
      EMPTY_DELIVERY,
      ANNOUNCEMENT_ID,
      "banner",
      NOW,
    );
    const hidden = hideForLater(shown, ANNOUNCEMENT_ID, NOW);

    const state = dismissAnnouncement(hidden, ANNOUNCEMENT_ID);

    expect(state.activeId).toBeNull();
    expect(state.presentation).toBeNull();
    expect(state.snoozedUntil[ANNOUNCEMENT_ID]).toBeUndefined();
    expect(state.dismissed).toContain(ANNOUNCEMENT_ID);
    expect(getAnnouncementStatus(state, ANNOUNCEMENT_ID, NOW)).toBe(
      "dismissed",
    );
  });

  it("returns the status of each delivery state", () => {
    expect(getAnnouncementStatus(EMPTY_DELIVERY, ANNOUNCEMENT_ID, NOW)).toBe(
      "idle",
    );

    const shown = showAnnouncement(
      EMPTY_DELIVERY,
      ANNOUNCEMENT_ID,
      "dialog",
      NOW,
    );

    expect(getAnnouncementStatus(shown, ANNOUNCEMENT_ID, NOW)).toBe("visible");
    expect(
      getAnnouncementStatus(
        hideForLater(shown, ANNOUNCEMENT_ID, NOW),
        ANNOUNCEMENT_ID,
        NOW,
      ),
    ).toBe("snoozed");
    expect(
      getAnnouncementStatus(
        dismissAnnouncement(shown, ANNOUNCEMENT_ID),
        ANNOUNCEMENT_ID,
        NOW,
      ),
    ).toBe("dismissed");
  });

  it("returns the visible announcement with its presentation", () => {
    const state = showAnnouncement(
      EMPTY_DELIVERY,
      ANNOUNCEMENT_ID,
      "banner",
      NOW,
    );

    const visible = getVisibleAnnouncement(state, ANNOUNCEMENTS, NOW);

    expect(visible?.announcement.id).toBe(ANNOUNCEMENT_ID);
    expect(visible?.presentation).toBe("banner");
  });

  it("returns null for a hidden, dismissed, or unknown announcement", () => {
    const shown = showAnnouncement(
      EMPTY_DELIVERY,
      ANNOUNCEMENT_ID,
      "dialog",
      NOW,
    );

    expect(
      getVisibleAnnouncement(
        hideForLater(shown, ANNOUNCEMENT_ID, NOW),
        ANNOUNCEMENTS,
        NOW,
      ),
    ).toBeNull();
    expect(
      getVisibleAnnouncement(
        dismissAnnouncement(shown, ANNOUNCEMENT_ID),
        ANNOUNCEMENTS,
        NOW,
      ),
    ).toBeNull();
    expect(
      getVisibleAnnouncement(
        showAnnouncement(EMPTY_DELIVERY, "missing", "dialog", NOW),
        ANNOUNCEMENTS,
        NOW,
      ),
    ).toBeNull();
  });

  it("does not change the input state", () => {
    const state = showAnnouncement(
      EMPTY_DELIVERY,
      ANNOUNCEMENT_ID,
      "dialog",
      NOW,
    );
    const snapshot = JSON.stringify(state);

    hideForLater(state, ANNOUNCEMENT_ID, NOW);
    dismissAnnouncement(state, ANNOUNCEMENT_ID);

    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
