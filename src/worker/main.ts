import type { ProxyMarked } from "comlink";

function markAsProxy<T>(lib: T): T & ProxyMarked {
  return lib as T & ProxyMarked;
}

export { setLanguage } from "./i18n.ts";

import * as greetingRaw from "./greeting.ts";
export const greeting = markAsProxy(greetingRaw);
