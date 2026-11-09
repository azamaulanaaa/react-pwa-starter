import type React from "react";
import { useMemo } from "react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Badge, type BadgeProps } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  TableGeneric,
  type TableGenericColumnDef,
} from "@/components/table/generic/index.tsx";
import { getAnnouncementStatus } from "@/components/announcement/delivery.ts";
import type {
  Announcement,
  AnnouncementDelivery,
  AnnouncementPresentation,
  AnnouncementStatus,
  AnnouncementVariant,
} from "@/components/announcement/types.ts";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const VARIANT_BADGES: Record<AnnouncementVariant, BadgeVariant> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
};

const PRESENTATION_BADGES: Record<AnnouncementPresentation, BadgeVariant> = {
  dialog: "outline",
  banner: "secondary",
};

const STATUS_BADGES: Record<AnnouncementStatus, BadgeVariant> = {
  idle: "secondary",
  visible: "success",
  snoozed: "warning",
  dismissed: "outline",
};

export interface AnnouncementViewProps {
  announcements: Announcement[];
  delivery: AnnouncementDelivery;
  now: number;
  onShow: (id: string, presentation: AnnouncementPresentation) => void;
}

/** Shows the announcement catalog and the two presentation actions. */
export function AnnouncementView({
  announcements,
  delivery,
  now,
  onShow,
}: AnnouncementViewProps): React.ReactElement {
  const { t } = useTranslation();

  const columns = useMemo<TableGenericColumnDef<Announcement>[]>(
    () => [
      {
        id: "title",
        header: t("system_announcements_column_title"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">{row.original.title}</span>
            <span className="text-muted-foreground text-sm">
              {row.original.body}
            </span>
          </div>
        ),
      },
      {
        id: "variant",
        header: t("system_announcements_column_variant"),
        cell: ({ row }) => (
          <Badge variant={VARIANT_BADGES[row.original.variant]}>
            {t(`system_announcement_variant_${row.original.variant}`)}
          </Badge>
        ),
      },
      {
        id: "preferred",
        header: t("system_announcements_column_preferred"),
        cell: ({ row }) => (
          <Badge
            variant={PRESENTATION_BADGES[row.original.preferredPresentation]}
          >
            {t(
              `system_announcement_presentation_${row.original.preferredPresentation}`,
            )}
          </Badge>
        ),
      },
      {
        id: "status",
        header: t("system_announcements_column_status"),
        cell: ({ row }) => {
          const status = getAnnouncementStatus(delivery, row.original.id, now);

          return (
            <Badge variant={STATUS_BADGES[status]}>
              {t(`system_announcement_status_${status}`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("system_actions"),
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => onShow(row.original.id, "dialog")}
              size="sm"
              variant="outline"
            >
              {t("system_announcements_show_dialog")}
            </Button>
            <Button
              onClick={() => onShow(row.original.id, "banner")}
              size="sm"
              variant="outline"
            >
              {t("system_announcements_show_banner")}
            </Button>
          </div>
        ),
      },
    ],
    [delivery, now, onShow, t],
  );

  return (
    <Card data-slot="announcement-view">
      <CardHeader>
        <CardTitle>{t("system_announcements_title")}</CardTitle>
        <CardDescription>
          {t("system_announcements_description")}
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <TableGeneric
          caption={t("system_announcements_table_caption")}
          columns={columns}
          data={announcements}
          getRowId={(announcement) => announcement.id}
        />
      </CardPanel>
    </Card>
  );
}
