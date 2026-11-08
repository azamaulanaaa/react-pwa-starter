import type React from "react";
import { useEffect, useState } from "react";
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
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress.tsx";
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
import { QueueStateBadge } from "@/components/queue/state-badge.tsx";
import type {
  QueueActionResult,
  QueueActionTarget,
} from "@/components/queue/use-queue-jobs.ts";
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
  const { formatDate, formatNumber, formatPercent } = useIntl();
  const side = useSheetSide();
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
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

  useEffect(() => {
    setActionError(null);
    setCancelError(null);
    setCancelOpen(false);
  }, [job.id]);

  const runAction = async (
    action: () => Promise<QueueActionResult>,
  ): Promise<QueueActionResult> => {
    const result = await action();

    if (result.ok) {
      setActionError(null);
    } else {
      setActionError(
        result.reason === "unavailable"
          ? t("system_action_unavailable")
          : result.error.message,
      );
    }

    return result;
  };

  const runCancel = async (): Promise<void> => {
    const result = await runAction(() => onCancel(job.id));

    if (result.ok) {
      setCancelError(null);
      setCancelOpen(false);
      return;
    }

    setCancelError(
      result.reason === "unavailable"
        ? t("system_action_unavailable")
        : result.error.message,
    );
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="sm:max-w-lg" side={side}>
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
              <DetailField label={t("system_detail_kind")} mono>
                {job.kind}
              </DetailField>
              <DetailField label={t("system_detail_attempt")}>
                {formatNumber(job.attempt)}
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

            <Progress max={100} value={Math.round(job.progress * 100)}>
              <div className="flex items-center justify-between gap-2">
                <ProgressLabel>{t("system_detail_progress")}</ProgressLabel>
                <ProgressValue>
                  {(_formatted, value) => formatPercent((value ?? 0) / 100)}
                </ProgressValue>
              </div>
              <ProgressTrack>
                <ProgressIndicator />
              </ProgressTrack>
            </Progress>

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
          {actionError && (
            <div className="px-6 pb-3">
              <Alert variant="error">
                <TriangleAlertIcon />
                <AlertTitle>{t("system_error_title")}</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            </div>
          )}
          <SheetFooter className="flex-wrap" variant="bare">
            {canPause && (
              <Button
                loading={pausePending}
                onClick={() => void runAction(() => onPause(job.id))}
                variant="outline"
              >
                {t("system_pause")}
              </Button>
            )}
            {canResume && (
              <Button
                loading={resumePending}
                onClick={() => void runAction(() => onResume(job.id))}
                variant="outline"
              >
                {t("system_resume")}
              </Button>
            )}
            {canCancel && (
              <AlertDialog
                onOpenChange={(next) => {
                  setCancelOpen(next);
                  if (!next) setCancelError(null);
                }}
                open={cancelOpen}
              >
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
                  {cancelError && (
                    <div className="px-6 pb-4">
                      <Alert variant="error">
                        <TriangleAlertIcon />
                        <AlertTitle>{t("system_error_title")}</AlertTitle>
                        <AlertDescription>{cancelError}</AlertDescription>
                      </Alert>
                    </div>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="outline" />}>
                      {t("system_cancel_keep")}
                    </AlertDialogClose>
                    <Button
                      loading={cancelPending}
                      onClick={() => void runCancel()}
                      variant="destructive"
                    >
                      {t("system_cancel_job")}
                    </Button>
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
