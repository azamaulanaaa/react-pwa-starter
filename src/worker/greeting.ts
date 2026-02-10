import { getI18n } from "@/worker/i18n.ts";

export const getGreeting = async (name: string) => {
  const i18n = await getI18n();
  const t = i18n.getFixedT(null, "worker");

  return t("greeting", { name });
};
