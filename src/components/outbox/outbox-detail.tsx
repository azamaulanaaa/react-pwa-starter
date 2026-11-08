import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, TriangleAlertIcon } from "lucide-react";

import { useIntl } from "@/components/context/intl.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Separator } from "@/components/ui/separator.tsx";
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
import {
  DetailField,
  DetailFields,
} from "@/components/shared/detail-fields.tsx";
import { JsonView } from "@/components/shared/json-view.tsx";
import { useSheetSide } from "@/components/shared/use-sheet-side.ts";
import {
  MethodBadge,
  OutboxStateBadge,
} from "@/components/outbox/state-badge.tsx";
import type { OutboxOp } from "@/lib/outbox/types.ts";

export interface OutboxDetailProps {
  op: OutboxOp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Shows the full record of one outbox operation. */
export function OutboxDetail({
  op,
  open,
  onOpenChange,
}: OutboxDetailProps): React.ReactElement {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useIntl();
  const side = useSheetSide();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const handleCopyId = (): void => {
    if (!navigator.clipboard?.writeText) return;

    void navigator.clipboard
      .writeText(op.id)
      .then(() => {
        setCopied(true);
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1000);
      })
      .catch(() => {});
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-lg" side={side}>
        <div className="contents" data-slot="outbox-detail">
          <SheetHeader>
            <SheetTitle>{t("system_detail_outbox_title")}</SheetTitle>
            <SheetDescription className="font-mono break-all text-xs">
              {op.id}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <OutboxStateBadge state={op.state} />
              <MethodBadge method={op.method} />
            </div>
          </SheetHeader>
          <SheetPanel className="flex flex-col gap-5">
            <DetailFields>
              <DetailField label={t("system_detail_kind")} mono>
                {op.kind}
              </DetailField>
              <DetailField label={t("system_detail_path")} mono>
                {op.path}
              </DetailField>
              <DetailField label={t("system_detail_attempts")}>
                {formatNumber(op.attempts)}
              </DetailField>
              <DetailField label={t("system_detail_created")}>
                {formatDate(op.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </DetailField>
              <DetailField label={t("system_detail_next_attempt")}>
                {formatDate(op.nextAttemptAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </DetailField>
            </DetailFields>

            <Separator />

            <div className="flex flex-col gap-2">
              <h3 className="font-medium text-sm">{t("system_detail_body")}</h3>
              <JsonView
                emptyLabel={t("system_detail_no_body")}
                value={op.body ?? undefined}
              />
            </div>

            {op.lastError && (
              <Alert variant="error">
                <TriangleAlertIcon />
                <AlertTitle>{t("system_detail_last_error")}</AlertTitle>
                <AlertDescription>
                  <span className="font-mono text-xs">{op.lastError.code}</span>
                  <span>{op.lastError.message}</span>
                </AlertDescription>
              </Alert>
            )}
          </SheetPanel>
          <SheetFooter variant="bare">
            <span aria-live="polite" className="sr-only" role="status">
              {copied ? t("system_copied") : ""}
            </span>
            <Button onClick={handleCopyId} variant="outline">
              {copied ? <CheckIcon /> : <CopyIcon />}
              {t("system_copy_id")}
            </Button>
            <SheetClose render={<Button variant="ghost" />}>
              {t("system_close")}
            </SheetClose>
          </SheetFooter>
        </div>
      </SheetPopup>
    </Sheet>
  );
}
