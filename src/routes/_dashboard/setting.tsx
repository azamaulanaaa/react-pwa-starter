import { useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useTranslation } from "@/components/context/translation.tsx";
import {
  Card,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  FormSetting,
  FormSettingValue,
} from "@/components/form/setting/index.tsx";
import { useConfig } from "@/components/context/config.tsx";
import { toastManager } from "@/components/ui/toast.tsx";

function Page() {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();

  const defaultValue = useMemo(
    () => ({
      theme: config.theme,
      locale: config.locale,
    }),
    [config],
  );

  const handleOnSubmit = useCallback(
    (value: FormSettingValue) => {
      updateConfig(value);
      toastManager.add({
        description: t("page_dashboard_setting_toast_saved_description"),
        title: t("page_dashboard_setting_toast_saved_title"),
        type: "success",
      });
    },
    [updateConfig, t],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("page_dashboard_setting_title")}</CardTitle>
      </CardHeader>
      <CardPanel>
        <FormSetting
          defaultValue={defaultValue as unknown as FormSettingValue}
          onSubmit={handleOnSubmit}
        />
      </CardPanel>
    </Card>
  );
}

export const Route = createFileRoute("/_dashboard/setting")({
  component: Page,
  staticData: {
    breadcrumb: "Setting",
  },
});
