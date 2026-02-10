import { z } from "zod";
import i18next from "i18next";

// Define the mapping between browser/i18next codes and Zod locales
const ZOD_LOCALE_MAP: Record<string, any> = {
  "en": z.locales.en,
};

export function syncZodLocale(lng?: string) {
  const code = (lng || i18next.language || "en").split("-")[0];
  const locale = ZOD_LOCALE_MAP[code] || z.locales.en;

  z.config(locale());
}
