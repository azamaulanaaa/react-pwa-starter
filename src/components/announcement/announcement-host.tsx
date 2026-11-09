import type React from "react";

import { AnnouncementBanner } from "@/components/announcement/announcement-banner.tsx";
import { AnnouncementDialog } from "@/components/announcement/announcement-dialog.tsx";
import { useAnnouncements } from "@/components/announcement/use-announcements.ts";

/** Shows the active announcement once for the dashboard shell. */
export function AnnouncementHost(): React.ReactElement | null {
  const { visible, announce, hideForLater, dismiss } = useAnnouncements();

  if (visible === null) return null;

  const { announcement, presentation } = visible;

  if (presentation === "banner") {
    return (
      <AnnouncementBanner
        announcement={announcement}
        className="mx-2 mt-2"
        onHide={() => hideForLater(announcement.id)}
        onReadMore={() => announce(announcement.id, "dialog")}
      />
    );
  }

  return (
    <AnnouncementDialog
      announcement={announcement}
      onDismiss={() => dismiss(announcement.id)}
      onHide={() => hideForLater(announcement.id)}
      open
    />
  );
}
