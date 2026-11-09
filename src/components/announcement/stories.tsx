import type { Story, StoryDefault } from "@ladle/react";
import { useId } from "react";

import { AnnouncementBanner } from "@/components/announcement/announcement-banner.tsx";
import { AnnouncementDialog } from "@/components/announcement/announcement-dialog.tsx";
import { AnnouncementForm } from "@/components/announcement/announcement-form.tsx";
import { AnnouncementView as AnnouncementViewComponent } from "@/components/announcement/announcement-view.tsx";
import { ANNOUNCEMENTS } from "@/components/announcement/data.ts";
import { SNOOZE_MS } from "@/components/announcement/delivery.ts";
import type { AnnouncementDelivery } from "@/components/announcement/types.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  FormAnnouncement,
  type FormAnnouncementValue,
} from "@/components/form/announcement/index.tsx";

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
    onCreate={noop}
  />
);

export const AnnouncementFormStory: Story = () => (
  <AnnouncementForm onCreate={noop} onOpenChange={noop} open />
);

export const FormAnnouncementStory: Story = () => {
  const formId = useId();
  const handleSubmit = (value: FormAnnouncementValue) => {
    alert(JSON.stringify(value));
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <FormAnnouncement formId={formId} onSubmit={handleSubmit} />
      <Button form={formId} type="submit">
        Submit
      </Button>
    </div>
  );
};

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
