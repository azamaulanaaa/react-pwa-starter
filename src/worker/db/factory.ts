import type { Effect, Schema, Stream } from "effect";

import { createChangeBus, type ChangeBus } from "@/worker/db/change-bus.ts";
import { createKvApi, type KvApi } from "@/worker/db/kv.ts";
import { openStore } from "@/worker/db/store.ts";
import { createTableApi } from "@/worker/db/table.ts";
import type { Base } from "@/worker/db/schema.ts";

export type ApiFunction<Args extends any[], A, E> = (
  ...args: Args
) => Effect.Effect<A, E, never> | Stream.Stream<A, E, never>;

type ModuleContext = {
  kv: KvApi;
  subscribe: ChangeBus["subscribe"];
};

export type TableModule<
  Name extends string,
  Api extends Record<string, ApiFunction<any, any, any>>,
> = {
  name: Name;
  api: (ctx: ModuleContext) => Api;
};

type ExtractApiShape<T> = T extends
  { name: infer Name extends string; api: (ctx: any) => infer Api }
  ? { [K in Name]: Api }
  : never;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends
  (k: infer I) => void ? I
  : never;

type GetModuleValues<T> = T extends Record<string, infer M>
  ? M extends TableModule<any, any> ? M : never
  : never;

export const createTableModule =
  <Name extends string, A extends Base, I>(config: {
    name: Name;
    schema: Schema.Schema<A, I, never>;
  }) =>
  <
    CustomApi extends Record<string, ApiFunction<any, any, any>> = {},
  >(
    moduleConfig?: {
      extensions?: (
        ctx: ModuleContext,
        crud: ReturnType<typeof createTableApi<Name, A, I>>,
      ) => CustomApi;
    },
  ): TableModule<
    Name,
    ReturnType<typeof createTableApi<Name, A, I>> & CustomApi
  > => {
    return {
      name: config.name,
      api: (ctx) => {
        const crud = createTableApi({
          tableName: config.name,
          schema: config.schema,
          kv: ctx.kv,
          subscribe: ctx.subscribe,
        });
        const customApi = moduleConfig?.extensions
          ? moduleConfig.extensions(ctx, crud)
          : ({} as CustomApi);

        return {
          ...crud,
          ...customApi,
        };
      },
    };
  };

export function createDatabase<
  T extends Record<string, TableModule<any, any>>,
>(
  name: string,
  tables: T,
) {
  type DatabaseApi = UnionToIntersection<ExtractApiShape<GetModuleValues<T>>>;

  const bus = createChangeBus();
  const ctx: ModuleContext = {
    kv: createKvApi({ open: () => openStore(name), bus }),
    subscribe: bus.subscribe,
  };

  return Object.fromEntries(
    Object.values(tables).map((mod) => [mod.name, mod.api(ctx)]),
  ) as DatabaseApi;
}
