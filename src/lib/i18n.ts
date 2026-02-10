import i18next, { InitOptions } from "i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

const config: InitOptions<{ loadPath: string }> = {
  fallbackLng: "en",
  backend: {
    loadPath: "/locales/{{lng}}/{{ns}}.json",
  },
  interpolation: { escapeValue: false },
};

export async function i18nbase(namespace: string | string[]) {
  const i18n = i18next.createInstance();

  await i18n
    .use(HttpBackend)
    .init({ ...config, ns: namespace });

  return i18n;
}

export async function i18nreact(namespace: string | string[]) {
  const i18n = i18next.createInstance();

  await i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .init({ ...config, ns: namespace });

  return i18n;
}
