import { Effect } from "effect";

import { i18nbase } from "@/lib/i18n.ts";

const makeI18nCache = Effect.cached(Effect.promise(() => i18nbase("worker")));

const getI18n = Effect.gen(function* () {
  return yield* makeI18nCache;
}).pipe(Effect.flatten);

export function changeLanguage(lang: string) {
  return Effect.gen(function* () {
    const i18n = yield* getI18n;
    yield* Effect.promise(() => i18n.changeLanguage(lang));
  });
}

export function getT(ns: string) {
  return Effect.gen(function* () {
    const i18n = yield* getI18n;
    const fixedT = i18n.getFixedT(ns);

    return { t: fixedT, i18n };
  });
}
