import { i18nbase } from "@/lib/i18n.ts";

const i18nPromise = i18nbase("worker");

export async function getI18n() {
  return await i18nPromise;
}

export async function setLanguage(lang: string) {
  const i18n = await getI18n();
  await i18n.changeLanguage(lang);
}

export async function useTranslation(ns: string) {
  const i18n = await getI18n();

  const fixedT = i18n.getFixedT(null, ns);

  const t = (key: string, options?: Record<string, string | number>) => {
    return fixedT(key, options);
  };

  return { t, i18n };
}
