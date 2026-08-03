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

function Page() {
  const { t } = useTranslation();
  const { config, updateConfig } = useConfig();

  const defaultValue = useMemo(() => ({
    theme: config.theme,
    locale: config.locale,
  }), [config]);

  const handleOnChange = useCallback((value: FormSettingValue) => {
    updateConfig(value);
  }, [updateConfig]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("page_dashboard_setting_title")}</CardTitle>
      </CardHeader>
      <CardPanel>
        <FormSetting
          defaultValue={defaultValue as any}
          onSubmit={handleOnChange}
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
