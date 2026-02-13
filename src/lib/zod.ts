import { z } from "zod";

// Define the mapping between browser/i18next codes and Zod locales
const ZOD_LOCALE_MAP: Record<string, () => Partial<z.core.$ZodConfig>> = {
  "en": z.locales.en,
};

export async function syncZodLocale(lng?: string) {
  const code = lng?.split("-")[0];
  const locale = ZOD_LOCALE_MAP[code!] ?? ZOD_LOCALE_MAP["en"];

  z.config(locale());
}
