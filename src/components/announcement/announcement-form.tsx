import type React from "react";
import { useId } from "react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { FormAnnouncement } from "@/components/form/announcement/index.tsx";
import type { AnnouncementInput } from "@/components/announcement/types.ts";

export interface AnnouncementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: AnnouncementInput) => void;
}

/** Creates a custom announcement and shows it with the chosen presentation. */
export function AnnouncementForm({
  open,
  onOpenChange,
  onCreate,
}: AnnouncementFormProps): React.ReactElement {
  const { t } = useTranslation();
  const formId = useId();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("system_announcements_form_title")}</DialogTitle>
          <DialogDescription>
            {t("system_announcements_form_description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <FormAnnouncement
            formId={formId}
            onSubmit={(value) => {
              onCreate(value);
              onOpenChange(false);
            }}
          />
        </DialogPanel>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            {t("system_announcements_form_cancel")}
          </Button>
          <Button form={formId} type="submit">
            {t("system_announcements_form_submit")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
