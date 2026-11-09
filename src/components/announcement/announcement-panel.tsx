import type React from "react";

import { AnnouncementView } from "@/components/announcement/announcement-view.tsx";
import { useAnnouncements } from "@/components/announcement/use-announcements.ts";

/** Connects the announcement view to the delivery state. */
export function AnnouncementPanel(): React.ReactElement {
  const { announcements, delivery, now, announce } = useAnnouncements();

  return (
    <AnnouncementView
      announcements={announcements}
      delivery={delivery}
      now={now}
      onShow={announce}
    />
  );
}
