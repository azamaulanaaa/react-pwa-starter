import type React from "react";
import { InboxIcon, ListChecksIcon, MegaphoneIcon } from "lucide-react";

import { useTranslation } from "@/components/context/translation.tsx";
import { PageHeader } from "@/components/shared/page-header.tsx";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs.tsx";
import { AnnouncementPanel } from "@/components/announcement/index.ts";
import { OutboxPanel } from "@/components/outbox/index.ts";
import { QueuePanel } from "@/components/queue/index.ts";

/** Shows the outbox, queue, and announcement tabs. */
export function SystemPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4" data-slot="system-page">
      <PageHeader
        description={t("page_dashboard_system_description")}
        title={t("page_dashboard_system_title")}
      />

      <Tabs className="gap-4" defaultValue="outbox">
        <TabsList variant="underline">
          <TabsTab value="outbox">
            <InboxIcon />
            {t("system_tab_outbox")}
          </TabsTab>
          <TabsTab value="queue">
            <ListChecksIcon />
            {t("system_tab_queue")}
          </TabsTab>
          <TabsTab value="announcements">
            <MegaphoneIcon />
            {t("system_tab_announcements")}
          </TabsTab>
        </TabsList>
        <TabsPanel value="outbox">
          <OutboxPanel />
        </TabsPanel>
        <TabsPanel value="queue">
          <QueuePanel />
        </TabsPanel>
        <TabsPanel value="announcements">
          <AnnouncementPanel />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
