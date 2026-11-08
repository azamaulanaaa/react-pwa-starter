import { createFileRoute } from "@tanstack/react-router";

import { useTranslation } from "@/components/context/translation.tsx";
import { PageHeader } from "@/components/shared/page-header.tsx";

function Page() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4" data-slot="dashboard-home">
      <PageHeader
        description={t("page_dashboard_home_description")}
        title={t("page_dashboard_home_title")}
      />
    </div>
  );
}

export const Route = createFileRoute("/_dashboard/")({
  component: Page,
  staticData: {
    breadcrumb: "layout_menu_home",
  },
});
