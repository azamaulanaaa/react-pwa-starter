import { useCallback, useEffect, useMemo, useState } from "react";

import { ANNOUNCEMENTS } from "@/components/announcement/data.ts";
import {
  EMPTY_DELIVERY,
  dismissAnnouncement,
  getVisibleAnnouncement,
  hideForLater as snoozeAnnouncement,
  showAnnouncement,
} from "@/components/announcement/delivery.ts";
import type {
  Announcement,
  AnnouncementDelivery,
  AnnouncementPresentation,
} from "@/components/announcement/types.ts";
import { usePersistState } from "@/hooks/primitives/use-persist-state.ts";

export const ANNOUNCEMENT_DELIVERY_KEY = "announcement_delivery";

export type VisibleAnnouncement = ReturnType<typeof getVisibleAnnouncement>;

export interface UseAnnouncementsResult {
  announcements: Announcement[];
  delivery: AnnouncementDelivery;
  now: number;
  visible: VisibleAnnouncement;
  announce: (id: string, presentation: AnnouncementPresentation) => void;
  hideForLater: (id: string) => void;
  dismiss: (id: string) => void;
}

/** Reads the announcement catalog and the delivery state. */
export function useAnnouncements(): UseAnnouncementsResult {
  const [delivery, setDelivery] = usePersistState<AnnouncementDelivery>(
    ANNOUNCEMENT_DELIVERY_KEY,
    EMPTY_DELIVERY,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const currentTime = Date.now();
    const futureExpiry = Object.values(delivery.snoozedUntil)
      .filter((expiry) => expiry > currentTime)
      .sort((left, right) => left - right)[0];

    if (futureExpiry === undefined) return;

    const timer = setTimeout(
      () => setNow(Date.now()),
      futureExpiry - currentTime,
    );

    return () => clearTimeout(timer);
  }, [delivery.snoozedUntil, now]);

  const announce = useCallback(
    (id: string, presentation: AnnouncementPresentation) => {
      setDelivery((state) =>
        showAnnouncement(state, id, presentation, Date.now()),
      );
    },
    [setDelivery],
  );

  const hideForLater = useCallback(
    (id: string) => {
      setDelivery((state) => snoozeAnnouncement(state, id, Date.now()));
    },
    [setDelivery],
  );

  const dismiss = useCallback(
    (id: string) => {
      setDelivery((state) => dismissAnnouncement(state, id));
    },
    [setDelivery],
  );

  const visible = useMemo(
    () => getVisibleAnnouncement(delivery, ANNOUNCEMENTS, now),
    [delivery, now],
  );

  return {
    announcements: ANNOUNCEMENTS,
    delivery,
    now,
    visible,
    announce,
    hideForLater,
    dismiss,
  };
}
