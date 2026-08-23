import { Effect, type Schema, type Stream } from "effect";
import type { BTreeStore } from "oxkv";

import {
  createChangeBus,
  createEventBus,
  type ChangeBus,
  type DbEvent,
  type EventHandler,
  type EventBus,
} from "@/worker/db/change-bus.ts";
import { DbError } from "@/worker/db/error.ts";
import { createKvApi, type KvApi } from "@/worker/db/kv.ts";
import { openStore } from "@/worker/db/store.ts";
import { createTableApi } from "@/worker/db/table.ts";
import type { Base } from "@/worker/db/schema.ts";

export {
  createEventBus,
  type DbDeleteEvent,
  type DbEvent,
  type DbSetEvent,
  type EventHandler,
  type EventBus,
} from "@/worker/db/change-bus.ts";
export type ApiFunction<Args extends any[], A, E> = (
  ...args: Args
) => Effect.Effect<A, E, never> | Stream.Stream<A, E, never>;

type ModuleContext = {
  kv: KvApi;
  subscribe: ChangeBus["subscribe"];
  emit: (event: DbEvent) => Effect.Effect<void, DbError>;
  onEvent: (handler: EventHandler) => () => void;
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
          emit: ctx.emit,
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

export type DatabaseConfig = {
  events?: EventBus;
  hydrate?: (store: BTreeStore) => Effect.Effect<void, DbError>;
};

export function createDatabase<
  T extends Record<string, TableModule<any, any>>,
>(
  name: string,
  tables: T,
  config: DatabaseConfig = {},
) {
  type DatabaseApi = UnionToIntersection<ExtractApiShape<GetModuleValues<T>>>;

  const bus = createChangeBus();
  const events = config.events ?? createEventBus();

  events.subscribe((event) => {
    bus.notify(event.table);
    return Effect.void;
  });

  let ready: Promise<BTreeStore> | null = null;

  const open = () => {
    if (!ready) {
      ready = (async () => {
        const store = await openStore(name);

        try {
          if (config.hydrate) {
            await Effect.runPromise(config.hydrate(store));
          }
        } catch (error) {
          ready = null;
          throw error;
        }

        return store;
      })();
    }

    return ready;
  };

  const ctx: ModuleContext = {
    kv: createKvApi({ open, bus }),
    subscribe: bus.subscribe,
    emit: events.emit,
    onEvent: events.subscribe,
  };

  return Object.fromEntries(
    Object.values(tables).map((mod) => [mod.name, mod.api(ctx)]),
  ) as DatabaseApi;
}
