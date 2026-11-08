import { useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useTranslation } from "@/components/context/translation.tsx";
import { Card, CardPanel } from "@/components/ui/card.tsx";
import {
  FormSetting,
  FormSettingValue,
} from "@/components/form/setting/index.tsx";
import { useConfig } from "@/components/context/config.tsx";
import { PageHeader } from "@/components/shared/page-header.tsx";
import { toastManager } from "@/components/ui/toast.tsx";

function Page() {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();

  const value = useMemo<FormSettingValue>(
    () => ({
      theme: config.theme,
      locale: config.locale as FormSettingValue["locale"],
    }),
    [config.locale, config.theme],
  );

  const handleOnSubmit = useCallback(
    (nextValue: FormSettingValue) => {
      updateConfig(nextValue);
      toastManager.add({
        description: t("page_dashboard_setting_toast_saved_description"),
        title: t("page_dashboard_setting_toast_saved_title"),
        type: "success",
      });
    },
    [updateConfig, t],
  );

  return (
    <div className="flex flex-col gap-4" data-slot="dashboard-setting">
      <PageHeader
        description={t("page_dashboard_setting_description")}
        title={t("page_dashboard_setting_title")}
      />
      <Card>
        <CardPanel>
          <FormSetting onSubmit={handleOnSubmit} value={value} />
        </CardPanel>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_dashboard/setting")({
  component: Page,
  staticData: {
    breadcrumb: "layout_menu_setting",
  },
});
