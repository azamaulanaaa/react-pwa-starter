import i18next, { InitOptions } from "i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

import type NsUiType from "public/locales/en/ui.json";
import type NsWorkerType from "public/locales/en/worker.json";

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

declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      ui: typeof NsUiType;
      worker: typeof NsWorkerType;
    };
  }
}
