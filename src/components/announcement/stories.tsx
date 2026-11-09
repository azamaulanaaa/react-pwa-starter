import type { Story, StoryDefault } from "@ladle/react";

import { AnnouncementBanner } from "@/components/announcement/announcement-banner.tsx";
import { AnnouncementDialog } from "@/components/announcement/announcement-dialog.tsx";
import { AnnouncementView as AnnouncementViewComponent } from "@/components/announcement/announcement-view.tsx";
import { ANNOUNCEMENTS } from "@/components/announcement/data.ts";
import { SNOOZE_MS } from "@/components/announcement/delivery.ts";
import type { AnnouncementDelivery } from "@/components/announcement/types.ts";

const NOW = Date.UTC(2026, 0, 12, 8, 30);

const DELIVERY: AnnouncementDelivery = {
  activeId: ANNOUNCEMENTS[0].id,
  presentation: "dialog",
  snoozedUntil: { [ANNOUNCEMENTS[1].id]: NOW + SNOOZE_MS },
  dismissed: [ANNOUNCEMENTS[2].id],
};

function noop(): void {}

export default {
  title: "Announcement",
} as StoryDefault;

export const AnnouncementView: Story = () => (
  <AnnouncementViewComponent
    announcements={ANNOUNCEMENTS}
    delivery={DELIVERY}
    now={NOW}
  />
);

export const AnnouncementBannerStory: Story = () => (
  <div className="p-6">
    <AnnouncementBanner
      announcement={ANNOUNCEMENTS[1]}
      onHide={noop}
      onReadMore={noop}
    />
  </div>
);

export const AnnouncementDialogStory: Story = () => (
  <AnnouncementDialog
    announcement={ANNOUNCEMENTS[0]}
    onDismiss={noop}
    onHide={noop}
    open
  />
);
