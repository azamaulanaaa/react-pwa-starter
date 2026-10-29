import { createFileRoute } from "@tanstack/react-router";

import { useTranslation } from "@/components/context/translation.tsx";
import {
  Card,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card.tsx";

function Page() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("page_dashboard_home_title")}</CardTitle>
      </CardHeader>
      <CardPanel>
        <p className="text-muted-foreground">
          {t("page_dashboard_home_description")}
        </p>
      </CardPanel>
    </Card>
  );
}

export const Route = createFileRoute("/_dashboard/")({
  component: Page,
  staticData: {
    breadcrumb: "Home",
  },
});
