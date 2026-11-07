import type React from "react";
import { TriangleAlertIcon } from "lucide-react";

import { useIntl } from "@/components/context/intl.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
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
} from "@/components/system/detail-fields.tsx";
import { JsonView } from "@/components/system/json-view.tsx";
import { QueueStateBadge } from "@/components/system/state-badge.tsx";
import type {
  QueueActionResult,
  QueueActionTarget,
} from "@/components/system/use-queue-jobs.ts";
import type { Job } from "@/worker/queue/schema.ts";

export interface QueueDetailProps {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingAction: QueueActionTarget | null;
  onPause: (id: string) => Promise<QueueActionResult>;
  onResume: (id: string) => Promise<QueueActionResult>;
  onCancel: (id: string) => Promise<QueueActionResult>;
}

/** Shows the full record of one queue job and the allowed actions. */
export function QueueDetail({
  job,
  open,
  onOpenChange,
  pendingAction,
  onPause,
  onResume,
  onCancel,
}: QueueDetailProps): React.ReactElement {
  const { t } = useTranslation();
  const { formatDate, formatPercent } = useIntl();
  const canPause = job.state === "queued" || job.state === "running";
  const canResume = job.state === "paused";
  const canCancel =
    job.state === "queued" || job.state === "running" || job.state === "paused";
  const pausePending =
    pendingAction?.id === job.id && pendingAction.action === "pause";
  const resumePending =
    pendingAction?.id === job.id && pendingAction.action === "resume";
  const cancelPending =
    pendingAction?.id === job.id && pendingAction.action === "cancel";

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-lg" side="right">
        <div className="contents" data-slot="queue-detail">
          <SheetHeader>
            <SheetTitle>{t("system_detail_queue_title")}</SheetTitle>
            <SheetDescription className="font-mono break-all text-xs">
              {job.id}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <QueueStateBadge state={job.state} />
            </div>
          </SheetHeader>
          <SheetPanel className="flex flex-col gap-5">
            <DetailFields>
              <DetailField label={t("system_detail_id")} mono>
                {job.id}
              </DetailField>
              <DetailField label={t("system_detail_kind")} mono>
                {job.kind}
              </DetailField>
              <DetailField label={t("system_detail_state")}>
                <QueueStateBadge state={job.state} />
              </DetailField>
              <DetailField label={t("system_detail_attempt")}>
                {job.attempt}
              </DetailField>
              <DetailField label={t("system_detail_created")}>
                {formatDate(job.created_at, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </DetailField>
              <DetailField label={t("system_detail_updated")}>
                {formatDate(job.updated_at, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </DetailField>
            </DetailFields>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">
                  {t("system_detail_progress")}
                </span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {formatPercent(job.progress)}
                </span>
              </div>
              <Progress max={100} value={Math.round(job.progress * 100)} />
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <h3 className="font-medium text-sm">
                {t("system_detail_payload")}
              </h3>
              <JsonView
                emptyLabel={t("system_detail_no_payload")}
                value={job.payload ?? undefined}
              />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="font-medium text-sm">
                {t("system_detail_result")}
              </h3>
              <JsonView
                emptyLabel={t("system_detail_no_result")}
                value={job.result ?? undefined}
              />
            </div>

            {job.error && (
              <Alert variant="error">
                <TriangleAlertIcon />
                <AlertTitle>{t("system_detail_error")}</AlertTitle>
                <AlertDescription>{job.error}</AlertDescription>
              </Alert>
            )}
          </SheetPanel>
          <SheetFooter className="flex-wrap" variant="bare">
            {canPause && (
              <Button
                loading={pausePending}
                onClick={() => void onPause(job.id)}
                variant="outline"
              >
                {t("system_pause")}
              </Button>
            )}
            {canResume && (
              <Button
                loading={resumePending}
                onClick={() => void onResume(job.id)}
                variant="outline"
              >
                {t("system_resume")}
              </Button>
            )}
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive-outline" />}
                >
                  {t("system_cancel")}
                </AlertDialogTrigger>
                <AlertDialogPopup>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("system_cancel_title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("system_cancel_description")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="outline" />}>
                      {t("system_cancel_keep")}
                    </AlertDialogClose>
                    <AlertDialogClose
                      onClick={() => void onCancel(job.id)}
                      render={
                        <Button loading={cancelPending} variant="destructive" />
                      }
                    >
                      {t("system_cancel")}
                    </AlertDialogClose>
                  </AlertDialogFooter>
                </AlertDialogPopup>
              </AlertDialog>
            )}
            <SheetClose render={<Button variant="ghost" />}>
              {t("system_close")}
            </SheetClose>
          </SheetFooter>
        </div>
      </SheetPopup>
    </Sheet>
  );
}
