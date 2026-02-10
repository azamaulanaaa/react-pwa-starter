import { i18nbase } from "@/lib/i18n.ts";

const i18nPromise = i18nbase("worker");

export async function getI18n() {
  return await i18nPromise;
}

export async function setLanguage(lang: string) {
  const i18n = await getI18n();
  await i18n.changeLanguage(lang);
}
