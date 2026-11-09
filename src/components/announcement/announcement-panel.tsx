import type React from "react";

import { AnnouncementView } from "@/components/announcement/announcement-view.tsx";
import { useAnnouncements } from "@/components/announcement/use-announcements.ts";

/** Connects the announcement archive to the delivery state. */
export function AnnouncementPanel(): React.ReactElement {
  const { announcements, delivery, now, createAnnouncement } =
    useAnnouncements();

  return (
    <AnnouncementView
      announcements={announcements}
      delivery={delivery}
      now={now}
      onCreate={createAnnouncement}
    />
  );
}
