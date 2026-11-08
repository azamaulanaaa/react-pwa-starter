import type React from "react";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CircleCheckIcon,
  InboxIcon,
  LogInIcon,
  RefreshCwIcon,
  SearchIcon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
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
  EmptyContent,
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
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  TableGeneric,
  type TableGenericColumnDef,
} from "@/components/table/generic/index.tsx";
import { OutboxDetail } from "@/components/outbox/outbox-detail.tsx";
import {
  MethodBadge,
  OUTBOX_STATE_VARIANTS,
  OutboxStateBadge,
} from "@/components/outbox/state-badge.tsx";
import { TableSkeleton } from "@/components/shared/table-skeleton.tsx";
import { useDebounce } from "@/hooks/primitives/use-debounce.ts";
import type {
  OutboxFlushResult,
  OutboxOp,
  OutboxState,
  OutboxStatus,
} from "@/lib/outbox/types.ts";

// The worker deletes completed rows, so "done" is not a filter value.
type StateFilter = Exclude<OutboxState, "done"> | "all";

const COUNT_STATES = [
  "pending",
  "sending",
  "failed",
  "conflict",
] as const satisfies readonly OutboxState[];

const FILTER_VALUES: Record<StateFilter, string> = {
  all: "system_filter_all",
  pending: "system_state_pending",
  sending: "system_state_sending",
  failed: "system_state_failed",
  conflict: "system_state_conflict",
};

export interface OutboxViewProps {
  ops: OutboxOp[];
  status: OutboxStatus;
  loading: boolean;
  refreshing: boolean;
  error: Error | null;
  flushing: boolean;
  resuming: boolean;
  flushResult: OutboxFlushResult | null;
  onRefresh: () => void;
  onFlush: () => void;
  onResume: () => void;
  onDismissFlushResult: () => void;
}

/** Shows the outbox rows, the global actions, and the detail sheet. */
export function OutboxView({
  ops,
  status,
  loading,
  refreshing,
  error,
  flushing,
  resuming,
  flushResult,
  onRefresh,
  onFlush,
  onResume,
  onDismissFlushResult,
}: OutboxViewProps): React.ReactElement {
  const { t } = useTranslation();
  const { formatDate, formatNumber } = useIntl();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 200);

  const filterLabels = useMemo(() => {
    const labels = {} as Record<StateFilter, string>;
    for (const [value, key] of Object.entries(FILTER_VALUES)) {
      labels[value as StateFilter] = t(key);
    }
    return labels;
  }, [t]);

  const visibleOps = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();

    return ops.filter((op) => {
      if (stateFilter !== "all" && op.state !== stateFilter) return false;
      if (!term) return true;

      return (
        op.id.toLowerCase().includes(term) ||
        op.kind.toLowerCase().includes(term) ||
        op.path.toLowerCase().includes(term)
      );
    });
  }, [debouncedQuery, ops, stateFilter]);

  const columns = useMemo<TableGenericColumnDef<OutboxOp>[]>(
    () => [
      {
        id: "state",
        header: t("system_detail_state"),
        cell: ({ row }) => <OutboxStateBadge state={row.original.state} />,
      },
      {
        id: "method",
        header: t("system_detail_method"),
        cell: ({ row }) => <MethodBadge method={row.original.method} />,
      },
      {
        id: "path",
        header: t("system_detail_path"),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.path}</span>
        ),
      },
      {
        id: "kind",
        header: () => (
          <span className="max-md:hidden">{t("system_detail_kind")}</span>
        ),
        cell: ({ row }) => (
          <span className="max-md:hidden">{row.original.kind}</span>
        ),
      },
      {
        id: "attempts",
        header: () => (
          <span className="max-md:hidden">{t("system_detail_attempts")}</span>
        ),
        cell: ({ row }) => (
          <span className="max-md:hidden tabular-nums">
            {formatNumber(row.original.attempts)}
          </span>
        ),
      },
      {
        id: "created",
        header: t("system_detail_created"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs tabular-nums">
            {formatDate(row.original.createdAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        ),
      },
      {
        id: "nextAttempt",
        header: () => (
          <span className="max-md:hidden">
            {t("system_detail_next_attempt")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="max-md:hidden whitespace-nowrap text-xs tabular-nums">
            {formatDate(row.original.nextAttemptAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        ),
      },
      {
        id: "lastError",
        header: t("system_detail_last_error"),
        cell: ({ row }) => {
          const message = row.original.lastError?.message;
          if (!message) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <span className="flex max-w-40 items-center gap-1 text-muted-foreground">
              <TriangleAlertIcon className="size-3.5 shrink-0 text-destructive" />
              <span className="truncate">{message}</span>
            </span>
          );
        },
      },
      {
        id: "view",
        header: () => <span className="sr-only">{t("system_actions")}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              aria-label={t("system_view_details")}
              onClick={() => setSelectedId(row.original.id)}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronRightIcon className="rtl:rotate-180" />
            </Button>
          </div>
        ),
      },
    ],
    [formatDate, formatNumber, t],
  );

  const selected = ops.find((op) => op.id === selectedId) ?? null;
  const shown = formatNumber(visibleOps.length);
  const total = formatNumber(ops.length);
  const flushFailed =
    flushResult !== null && flushResult.failed + flushResult.conflict > 0;
  const clearFilters = (): void => {
    setQuery("");
    setStateFilter("all");
  };

  return (
    <Card data-slot="outbox-view">
      <CardHeader>
        <CardTitle>{t("system_outbox_title")}</CardTitle>
        <CardDescription>{t("system_outbox_description")}</CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2 max-sm:col-span-2 max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:w-full max-sm:justify-self-stretch">
          <Button loading={refreshing} onClick={onRefresh} variant="outline">
            <RefreshCwIcon />
            {t("system_refresh")}
          </Button>
          <Button loading={flushing} onClick={onFlush}>
            <UploadIcon />
            {t("system_flush")}
          </Button>
        </CardAction>
      </CardHeader>

      <CardPanel className="flex flex-col gap-4">
        <div
          className="flex flex-wrap items-center gap-2"
          data-slot="outbox-counts"
        >
          {COUNT_STATES.map((state) => (
            <Badge key={state} variant={OUTBOX_STATE_VARIANTS[state]}>
              {t(`system_state_${state}`)}
              <span className="tabular-nums">
                {formatNumber(status[state])}
              </span>
            </Badge>
          ))}
        </div>

        {status.paused && (
          <Alert variant="warning">
            <TriangleAlertIcon />
            <AlertTitle>{t("system_outbox_paused")}</AlertTitle>
            <AlertAction>
              <Button
                loading={resuming}
                onClick={onResume}
                size="sm"
                variant="outline"
              >
                {t("system_resume")}
              </Button>
            </AlertAction>
          </Alert>
        )}

        {status.signInRequired && (
          <Alert variant="error">
            <LogInIcon />
            <AlertTitle>{t("system_outbox_sign_in_required")}</AlertTitle>
            <AlertAction>
              <Button render={<Link to="/login" />} size="sm" variant="outline">
                {t("system_outbox_sign_in")}
              </Button>
            </AlertAction>
          </Alert>
        )}

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

        {flushResult && (
          <Alert
            role={flushFailed ? "alert" : "status"}
            variant={flushFailed ? "error" : "success"}
          >
            {flushFailed ? <TriangleAlertIcon /> : <CircleCheckIcon />}
            <AlertDescription>
              {t("system_flush_result", {
                sent: formatNumber(flushResult.sent),
                pending: formatNumber(flushResult.pending),
                failed: formatNumber(flushResult.failed),
                conflict: formatNumber(flushResult.conflict),
              })}
            </AlertDescription>
            <AlertAction>
              <Button
                aria-label={t("system_close")}
                onClick={onDismissFlushResult}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </AlertAction>
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
          <span className="shrink-0 whitespace-nowrap text-muted-foreground text-sm tabular-nums sm:ms-auto">
            {t("system_showing", { shown, total })}
          </span>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : visibleOps.length === 0 ? (
          ops.length > 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {t("system_empty_outbox_filtered_title")}
                </EmptyTitle>
                <EmptyDescription>
                  {t("system_empty_outbox_filtered_description")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={clearFilters} variant="outline">
                  {t("system_clear_filters")}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InboxIcon />
                </EmptyMedia>
                <EmptyTitle>{t("system_empty_outbox_title")}</EmptyTitle>
                <EmptyDescription>
                  {t("system_empty_outbox_description")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        ) : (
          <figure className="flex min-h-0 min-w-0 flex-1 flex-col">
            <TableGeneric
              caption={t("system_outbox_table_caption")}
              columns={columns}
              data={visibleOps}
              getRowId={(op) => op.id}
            />
          </figure>
        )}
      </CardPanel>

      {selected !== null && (
        <OutboxDetail
          onOpenChange={(next) => {
            if (!next) setSelectedId(null);
          }}
          open={selected !== null}
          op={selected}
        />
      )}
    </Card>
  );
}
