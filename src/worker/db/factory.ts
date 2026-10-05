import { Effect, type Schema, type Stream } from "effect";
import type { BTreeStore } from "oxkv";

import {
  type ChangeBus,
  createChangeBus,
  createEventBus,
  type DbEvent,
  type EventBus,
  type EventHandler,
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
  type EventBus,
  type EventHandler,
} from "@/worker/db/change-bus.ts";
// deno-lint-ignore no-explicit-any
export type ApiFunction<Args extends any[], A, E> = (
  ...args: Args
) => Effect.Effect<A, E, never> | Stream.Stream<A, E, never>;

type ModuleContext = {
  kv: KvApi;
  open: () => Promise<BTreeStore>;
  subscribe: ChangeBus["subscribe"];
  notify: ChangeBus["notify"];
  emit: (event: DbEvent) => Effect.Effect<void, DbError>;
  onEvent: (handler: EventHandler) => () => void;
};

export type TableModule<
  Name extends string,
  // deno-lint-ignore no-explicit-any
  Api extends Record<string, ApiFunction<any, any, any>>,
> = {
  name: Name;
  api: (ctx: ModuleContext) => Api;
};

type ExtractApiShape<T> = T extends {
  name: infer Name extends string;
  api: (ctx: ModuleContext) => infer Api;
} ? { [K in Name]: Api }
  : never;

type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void
    : never
) extends (k: infer I) => void ? I
  : never;

type GetModuleValues<T> = T extends Record<string, infer M>
  // deno-lint-ignore no-explicit-any
  ? M extends TableModule<any, any> ? M
  : never
  : never;

export const createTableModule = <Name extends string, A extends Base, I>(
  config: {
    name: Name;
    schema: Schema.Schema<A, I, never>;
  },
): TableModule<Name, ReturnType<typeof createTableApi<Name, A, I>>> => {
  return {
    name: config.name,
    api: (ctx) =>
      createTableApi({
        tableName: config.name,
        schema: config.schema,
        kv: ctx.kv,
        subscribe: ctx.subscribe,
        emit: ctx.emit,
      }),
  };
};

export function exportStore(
  store: BTreeStore,
): Effect.Effect<Uint8Array, DbError> {
  return Effect.tryPromise({
    try: () => store.save() as Promise<Uint8Array>,
    catch: (error) => new DbError({ error }),
  });
}

export function hydrateStore(
  store: BTreeStore,
  snapshot: Uint8Array,
): Effect.Effect<void, DbError> {
  return Effect.asVoid(
    Effect.tryPromise({
      try: () => store.load(snapshot),
      catch: (error) => new DbError({ error }),
    }),
  );
}

export type DatabaseConfig = {
  events?: EventBus;
  hydrate?: (store: BTreeStore) => Effect.Effect<void, DbError>;
  setup?: (ctx: ModuleContext) => void;
};

export function createDatabase<
  // deno-lint-ignore no-explicit-any
  T extends Record<string, TableModule<any, any>>,
>(name: string, tables: T, config: DatabaseConfig = {}) {
  type DatabaseApi = UnionToIntersection<ExtractApiShape<GetModuleValues<T>>>;

  const bus = createChangeBus();
  const events = config.events ?? createEventBus();

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
    open,
    subscribe: bus.subscribe,
    notify: bus.notify,
    emit: events.emit,
    onEvent: events.subscribe,
  };

  config.setup?.(ctx);

  return Object.fromEntries(
    Object.values(tables).map((mod) => [mod.name, mod.api(ctx)]),
  ) as DatabaseApi;
}
