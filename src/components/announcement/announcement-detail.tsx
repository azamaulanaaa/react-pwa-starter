import type React from "react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { useSheetSide } from "@/components/shared/use-sheet-side.ts";
import {
  AnnouncementPresentationBadge,
  AnnouncementStatusBadge,
  AnnouncementVariantBadge,
} from "@/components/announcement/announcement-badge.tsx";
import { getAnnouncementStatus } from "@/components/announcement/delivery.ts";
import type {
  Announcement,
  AnnouncementDelivery,
} from "@/components/announcement/types.ts";

export interface AnnouncementDetailProps {
  announcement: Announcement;
  delivery: AnnouncementDelivery;
  now: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Shows the full announcement in a read-only sheet. */
export function AnnouncementDetail({
  announcement,
  delivery,
  now,
  open,
  onOpenChange,
}: AnnouncementDetailProps): React.ReactElement {
  const { t } = useTranslation();
  const side = useSheetSide();

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-lg" side={side}>
        <div className="contents" data-slot="announcement-detail">
          <SheetHeader>
            <SheetTitle>{announcement.title}</SheetTitle>
            <SheetDescription>
              {t("system_announcements_sheet_description")}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <AnnouncementVariantBadge variant={announcement.variant} />
              <AnnouncementPresentationBadge
                presentation={announcement.preferredPresentation}
              />
              <AnnouncementStatusBadge
                status={getAnnouncementStatus(delivery, announcement.id, now)}
              />
            </div>
          </SheetHeader>
          <SheetPanel className="flex flex-col gap-5">
            <p className="whitespace-pre-wrap text-sm">{announcement.body}</p>
          </SheetPanel>
          <SheetFooter variant="bare">
            <SheetClose render={<Button variant="ghost" />}>
              {t("system_close")}
            </SheetClose>
          </SheetFooter>
        </div>
      </SheetPopup>
    </Sheet>
  );
}
