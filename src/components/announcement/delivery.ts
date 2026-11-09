import type {
  Announcement,
  AnnouncementDelivery,
  AnnouncementPresentation,
  AnnouncementStatus,
} from "@/components/announcement/types.ts";

export const EMPTY_DELIVERY: AnnouncementDelivery = {
  activeId: null,
  presentation: null,
  snoozedUntil: {},
  dismissed: [],
};

export const SNOOZE_MS = 24 * 60 * 60 * 1000;

function withoutKey<T>(
  record: Record<string, T>,
  key: string,
): Record<string, T> {
  if (!(key in record)) return record;

  const next = { ...record };
  delete next[key];

  return next;
}

/** Shows the announcement with the given presentation. */
export function showAnnouncement(
  state: AnnouncementDelivery,
  id: string,
  presentation: AnnouncementPresentation,
  _now: number,
): AnnouncementDelivery {
  return {
    activeId: id,
    presentation,
    snoozedUntil: withoutKey(state.snoozedUntil, id),
    dismissed: state.dismissed.filter((entry) => entry !== id),
  };
}

/** Snoozes the announcement and keeps the current presentation. */
export function hideForLater(
  state: AnnouncementDelivery,
  id: string,
  now: number,
): AnnouncementDelivery {
  return {
    ...state,
    snoozedUntil: { ...state.snoozedUntil, [id]: now + SNOOZE_MS },
  };
}

/** Dismisses the announcement and clears the active selection. */
export function dismissAnnouncement(
  state: AnnouncementDelivery,
  id: string,
): AnnouncementDelivery {
  const isActive = state.activeId === id;

  return {
    activeId: isActive ? null : state.activeId,
    presentation: isActive ? null : state.presentation,
    snoozedUntil: withoutKey(state.snoozedUntil, id),
    dismissed: state.dismissed.includes(id)
      ? state.dismissed
      : [...state.dismissed, id],
  };
}

/** Returns the delivery status of one announcement. */
export function getAnnouncementStatus(
  state: AnnouncementDelivery,
  id: string,
  now: number,
): AnnouncementStatus {
  const snoozedUntil = state.snoozedUntil[id];
  const isSnoozed = snoozedUntil !== undefined && snoozedUntil > now;
  const isDismissed = state.dismissed.includes(id);
  const isActive = state.activeId === id;

  if (isActive && !isSnoozed && !isDismissed) return "visible";
  if (isSnoozed) return "snoozed";
  if (isDismissed) return "dismissed";

  return "idle";
}

/** Returns the active announcement and its presentation when it is visible. */
export function getVisibleAnnouncement(
  state: AnnouncementDelivery,
  announcements: Announcement[],
  now: number,
): {
  announcement: Announcement;
  presentation: AnnouncementPresentation;
} | null {
  if (state.activeId === null || state.presentation === null) return null;
  if (getAnnouncementStatus(state, state.activeId, now) !== "visible") {
    return null;
  }

  const announcement = announcements.find(
    (entry) => entry.id === state.activeId,
  );

  if (!announcement) return null;

  return { announcement, presentation: state.presentation };
}
