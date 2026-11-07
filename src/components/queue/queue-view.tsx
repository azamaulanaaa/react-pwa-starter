import type React from "react";
import { useMemo, useState } from "react";
import {
  ChevronRightIcon,
  ListChecksIcon,
  RefreshCwIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { useIntl } from "@/components/context/intl.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import {
  TableGeneric,
  type TableGenericColumnDef,
} from "@/components/table/generic/index.tsx";
import { QueueDetail } from "@/components/queue/queue-detail.tsx";
import { QueueStateBadge } from "@/components/queue/state-badge.tsx";
import type {
  QueueActionResult,
  QueueActionTarget,
} from "@/components/queue/use-queue-jobs.ts";
import { useDebounce } from "@/hooks/primitives/use-debounce.ts";
import type { Job, JobState } from "@/worker/queue/schema.ts";

type StateFilter = JobState | "all";

const COUNT_STATES = [
  "queued",
  "running",
  "paused",
  "succeeded",
  "failed",
  "canceled",
] as const satisfies readonly JobState[];

const COUNT_VARIANTS = {
  queued: "outline",
  running: "info",
  paused: "warning",
  succeeded: "success",
  failed: "error",
  canceled: "outline",
} as const;

const FILTER_VALUES: Record<StateFilter, string> = {
  all: "system_filter_all",
  queued: "system_state_queued",
  running: "system_state_running",
  paused: "system_state_paused",
  succeeded: "system_state_succeeded",
  failed: "system_state_failed",
  canceled: "system_state_canceled",
};

export interface QueueViewProps {
  jobs: Job[];
  loading: boolean;
  error: Error | null;
  pendingAction: QueueActionTarget | null;
  onRefresh: () => void;
  onPause: (id: string) => Promise<QueueActionResult>;
  onResume: (id: string) => Promise<QueueActionResult>;
  onCancel: (id: string) => Promise<QueueActionResult>;
}

/** Shows the queue jobs, the per-job actions, and the detail sheet. */
export function QueueView({
  jobs,
  loading,
  error,
  pendingAction,
  onRefresh,
  onPause,
  onResume,
  onCancel,
}: QueueViewProps): React.ReactElement {
  const { t } = useTranslation();
  const { formatDate, formatNumber, formatPercent } = useIntl();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 200);

  const filterLabels = useMemo(() => {
    const labels = {} as Record<StateFilter, string>;
    for (const [value, key] of Object.entries(FILTER_VALUES)) {
      labels[value as StateFilter] = t(key);
    }
    return labels;
  }, [t]);

  const counts = useMemo(() => {
    const next = {} as Record<JobState, number>;
    for (const state of COUNT_STATES) next[state] = 0;
    for (const job of jobs) next[job.state] += 1;
    return next;
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();

    return jobs.filter((job) => {
      if (stateFilter !== "all" && job.state !== stateFilter) return false;
      if (!term) return true;

      return (
        job.id.toLowerCase().includes(term) ||
        job.kind.toLowerCase().includes(term)
      );
    });
  }, [debouncedQuery, jobs, stateFilter]);

  const columns = useMemo<TableGenericColumnDef<Job>[]>(
    () => [
      {
        id: "state",
        header: t("system_detail_state"),
        cell: ({ row }) => <QueueStateBadge state={row.original.state} />,
      },
      {
        id: "kind",
        header: t("system_detail_kind"),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.kind}</span>
        ),
      },
      {
        id: "progress",
        header: t("system_detail_progress"),
        cell: ({ row }) => (
          <div className="flex min-w-32 items-center gap-2">
            <Progress
              className="flex-1"
              max={100}
              value={Math.round(row.original.progress * 100)}
            />
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatPercent(row.original.progress)}
            </span>
          </div>
        ),
      },
      {
        id: "attempt",
        header: () => (
          <span className="max-md:hidden">{t("system_detail_attempt")}</span>
        ),
        cell: ({ row }) => (
          <span className="max-md:hidden tabular-nums">
            {formatNumber(row.original.attempt)}
          </span>
        ),
      },
      {
        id: "updated",
        header: () => (
          <span className="max-md:hidden">{t("system_detail_updated")}</span>
        ),
        cell: ({ row }) => (
          <span className="max-md:hidden whitespace-nowrap text-xs">
            {formatDate(row.original.updated_at, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        ),
      },
      {
        id: "error",
        header: t("system_detail_error"),
        cell: ({ row }) => {
          const message = row.original.error;
          if (!message) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="flex max-w-40 items-center gap-1 text-muted-foreground">
                    <TriangleAlertIcon className="size-3.5 shrink-0 text-destructive" />
                    <span className="truncate">{message}</span>
                  </span>
                }
              />
              <TooltipPopup>{message}</TooltipPopup>
            </Tooltip>
          );
        },
      },
      {
        id: "view",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              aria-label={t("system_view_details")}
              onClick={() => setSelectedId(row.original.id)}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        ),
      },
    ],
    [formatDate, formatNumber, formatPercent, t],
  );

  const selected = jobs.find((job) => job.id === selectedId) ?? null;
  const shown = formatNumber(visibleJobs.length);
  const total = formatNumber(jobs.length);

  const runAction = async (
    action: () => Promise<QueueActionResult>,
  ): Promise<QueueActionResult> => {
    const result = await action();
    if (result.ok) {
      setNotice(null);
      return result;
    }

    setNotice(
      result.reason === "unavailable"
        ? t("system_action_unavailable")
        : result.error.message,
    );
    return result;
  };

  return (
    <Card data-slot="queue-view">
      <CardHeader>
        <CardTitle>{t("system_queue_title")}</CardTitle>
        <CardDescription>{t("system_queue_description")}</CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <Button onClick={onRefresh} variant="outline">
            <RefreshCwIcon />
            {t("system_refresh")}
          </Button>
        </CardAction>
      </CardHeader>

      <CardPanel className="flex flex-col gap-4">
        <div
          className="flex flex-wrap items-center gap-2"
          data-slot="queue-counts"
        >
          {COUNT_STATES.map((state) => (
            <Badge key={state} variant={COUNT_VARIANTS[state]}>
              {t(`system_state_${state}`)}
              <span className="tabular-nums">
                {formatNumber(counts[state])}
              </span>
            </Badge>
          ))}
        </div>

        {error && (
          <Alert variant="error">
            <TriangleAlertIcon />
            <AlertTitle>{t("system_error_title")}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
            <AlertAction>
              <Button onClick={onRefresh} size="sm" variant="outline">
                {t("system_error_retry")}
              </Button>
            </AlertAction>
          </Alert>
        )}

        {notice && (
          <Alert variant="error">
            <TriangleAlertIcon />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center">
          <InputGroup className="sm:max-w-xs sm:flex-1">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={t("system_search_placeholder")}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("system_search_placeholder")}
              value={query}
            />
          </InputGroup>
          <Select
            items={filterLabels}
            onValueChange={(value) => setStateFilter(value as StateFilter)}
            value={stateFilter}
          >
            <SelectTrigger
              aria-label={t("system_filter_state")}
              className="w-full shrink-0 sm:w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {(Object.keys(FILTER_VALUES) as StateFilter[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {filterLabels[value]}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <span className="shrink-0 whitespace-nowrap text-muted-foreground text-sm sm:ms-auto">
            {t("system_showing", { shown, total })}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        ) : visibleJobs.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecksIcon />
              </EmptyMedia>
              <EmptyTitle>{t("system_empty_queue_title")}</EmptyTitle>
              <EmptyDescription>
                {t("system_empty_queue_description")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <TableGeneric
            columns={columns}
            data={visibleJobs}
            getRowId={(job) => job.id}
          />
        )}
      </CardPanel>

      {selected !== null && (
        <QueueDetail
          job={selected}
          onCancel={(id) => runAction(() => onCancel(id))}
          onOpenChange={(next) => {
            if (!next) setSelectedId(null);
          }}
          onPause={(id) => runAction(() => onPause(id))}
          onResume={(id) => runAction(() => onResume(id))}
          open={selected !== null}
          pendingAction={pendingAction}
        />
      )}
    </Card>
  );
}
