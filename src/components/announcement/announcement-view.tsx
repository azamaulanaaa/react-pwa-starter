import type React from "react";
import { useState } from "react";
import { ChevronRightIcon, InboxIcon } from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  AnnouncementPresentationBadge,
  AnnouncementStatusBadge,
  AnnouncementVariantBadge,
} from "@/components/announcement/announcement-badge.tsx";
import { AnnouncementDetail } from "@/components/announcement/announcement-detail.tsx";
import { getAnnouncementStatus } from "@/components/announcement/delivery.ts";
import type {
  Announcement,
  AnnouncementDelivery,
  AnnouncementPresentation,
} from "@/components/announcement/types.ts";

export interface AnnouncementViewProps {
  announcements: Announcement[];
  delivery: AnnouncementDelivery;
  now: number;
  onShow: (id: string, presentation: AnnouncementPresentation) => void;
}

/** Shows the announcement catalog and the detail sheet. */
export function AnnouncementView({
  announcements,
  delivery,
  now,
  onShow,
}: AnnouncementViewProps): React.ReactElement {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    announcements.find((announcement) => announcement.id === selectedId) ??
    null;

  return (
    <Card data-slot="announcement-view">
      <CardHeader>
        <CardTitle>{t("system_announcements_title")}</CardTitle>
        <CardDescription>
          {t("system_announcements_description")}
        </CardDescription>
      </CardHeader>
      <CardPanel>
        {announcements.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("system_announcements_empty_title")}</EmptyTitle>
              <EmptyDescription>
                {t("system_announcements_empty_description")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table className="table-fixed">
              <TableCaption className="sr-only">
                {t("system_announcements_table_caption")}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("system_announcements_column_title")}
                  </TableHead>
                  <TableHead className="hidden w-28 sm:table-cell">
                    {t("system_announcements_column_variant")}
                  </TableHead>
                  <TableHead className="hidden w-40 md:table-cell">
                    {t("system_announcements_column_preferred")}
                  </TableHead>
                  <TableHead className="hidden w-28 sm:table-cell">
                    {t("system_announcements_column_status")}
                  </TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{t("system_actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell className="max-w-0">
                      <div className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate font-medium">
                          {announcement.title}
                        </span>
                        <span className="truncate text-muted-foreground text-xs">
                          {announcement.body}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden w-28 sm:table-cell">
                      <AnnouncementVariantBadge
                        variant={announcement.variant}
                      />
                    </TableCell>
                    <TableCell className="hidden w-40 md:table-cell">
                      <AnnouncementPresentationBadge
                        presentation={announcement.preferredPresentation}
                      />
                    </TableCell>
                    <TableCell className="hidden w-28 sm:table-cell">
                      <AnnouncementStatusBadge
                        status={getAnnouncementStatus(
                          delivery,
                          announcement.id,
                          now,
                        )}
                      />
                    </TableCell>
                    <TableCell className="w-12">
                      <div className="flex justify-end">
                        <Button
                          aria-label={t("system_view_details")}
                          onClick={() => setSelectedId(announcement.id)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <ChevronRightIcon className="rtl:rotate-180" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardPanel>

      {selected !== null && (
        <AnnouncementDetail
          announcement={selected}
          delivery={delivery}
          now={now}
          onOpenChange={(next) => {
            if (!next) setSelectedId(null);
          }}
          onShow={onShow}
          open={selected !== null}
        />
      )}
    </Card>
  );
}
