import "@/lib/comlink/std.ts";
import "@/lib/comlink/effect.ts";

import type { ResolveEffect } from "@/lib/comlink/effect.ts";

type ResolveReturn<T> = ResolveEffect<T, Promise<Awaited<T>>>;

export type SyncRemoteProxy<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? (...args: Args) => ResolveReturn<Ret>
    : T[K] extends object ? SyncRemoteProxy<T[K]>
    : Promise<T[K]>;
};

export { expose, transfer, wrap } from "comlink";

export {
  interceptProxy,
  type ProxyCallInterceptor,
} from "@/lib/comlink/intercept.ts";
