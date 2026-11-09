import type React from "react";
import { MegaphoneIcon } from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils/cn.ts";
import type {
  Announcement,
  AnnouncementVariant,
} from "@/components/announcement/types.ts";

const VARIANT_TILES: Record<AnnouncementVariant, string> = {
  info: "bg-info/8 text-info",
  success: "bg-success/8 text-success",
  warning: "bg-warning/8 text-warning",
  error: "bg-destructive/8 text-destructive",
};

export interface AnnouncementDialogProps {
  announcement: Announcement;
  open: boolean;
  onHide: () => void;
  onDismiss: () => void;
}

/** Shows the announcement in a lightbox over a blurred backdrop. */
export function AnnouncementDialog({
  announcement,
  open,
  onHide,
  onDismiss,
}: AnnouncementDialogProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Dialog
      onOpenChange={(next, details) => {
        if (next) return;
        if (
          details.reason === "imperative-action" ||
          details.reason === "none"
        ) {
          return;
        }

        onHide();
      }}
      open={open}
    >
      <DialogPopup className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              VARIANT_TILES[announcement.variant],
            )}
          >
            <MegaphoneIcon aria-hidden="true" className="size-5" />
          </div>
          <DialogTitle>{announcement.title}</DialogTitle>
          <DialogDescription>{announcement.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter variant="bare">
          <Button onClick={onHide} variant="outline">
            {t("announcement_hide_for_later")}
          </Button>
          <Button onClick={onDismiss}>{t("announcement_got_it")}</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
