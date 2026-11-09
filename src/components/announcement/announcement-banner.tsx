import type React from "react";
import { MegaphoneIcon, XIcon } from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import type { Announcement } from "@/components/announcement/types.ts";

export interface AnnouncementBannerProps {
  announcement: Announcement;
  className?: string;
  onReadMore: () => void;
  onHide: () => void;
}

/** Shows the announcement in the page flow. */
export function AnnouncementBanner({
  announcement,
  className,
  onReadMore,
  onHide,
}: AnnouncementBannerProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Alert className={className} role="status" variant={announcement.variant}>
      <MegaphoneIcon aria-hidden="true" />
      <AlertTitle>{announcement.title}</AlertTitle>
      <AlertDescription>{announcement.body}</AlertDescription>
      <AlertAction>
        <Button onClick={onReadMore} size="sm" variant="outline">
          {t("announcement_read_more")}
        </Button>
        <Button
          aria-label={t("announcement_hide_for_later")}
          onClick={onHide}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  );
}
