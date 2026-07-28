import i18next, { InitOptions } from "i18next";
import HttpBackend from "i18next-http-backend";

import NsUi from "~/public/locales/en/ui.json" with { type: "json" };
import NsWorker from "~/public/locales/en/worker.json" with {
  type: "json",
};

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

declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      ui: typeof NsUi;
      worker: typeof NsWorker;
    };
  }
}
