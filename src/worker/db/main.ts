import { addRxPlugin, createRxDatabase, MangoQuery, RxStorage } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBMigrationPlugin } from "rxdb/plugins/migration-schema";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { proxy } from "comlink";
import { z } from "zod";

import { createRxMigration, createRxSchema } from "./lib/rx_schema.ts";
import { addZodHooks } from "./lib/add_zod_hook.ts";

import {
  ListMigrationSchema,
  ListSchema,
  ListSchemaLatest,
} from "./schemas/list.schema.ts";

export const collectionsRegistry = {
  list: {
    rxSchema: ListSchema,
    migrationSchema: ListMigrationSchema,
    zodSchemaLatest: ListSchemaLatest,
  },
} as const;

export type CollectionName = keyof typeof collectionsRegistry;

export type CollectionDocInput<C extends CollectionName> = z.input<
  typeof collectionsRegistry[C]["zodSchemaLatest"]
>;
export type CollectionDocOutput<C extends CollectionName> = z.infer<
  typeof collectionsRegistry[C]["zodSchemaLatest"]
>;

export type CollectionMangoQuery<C extends CollectionName> = MangoQuery<
  CollectionDocOutput<C>
>;

async function init(name: string) {
  addRxPlugin(RxDBMigrationPlugin);

  let storage: RxStorage<any, any> = getRxStorageDexie();

  if (import.meta.env.DEV) {
    addRxPlugin(RxDBDevModePlugin);
    storage = wrappedValidateAjvStorage({ storage });
  }

  const db = await createRxDatabase({
    name: name,
    storage,
  });

  const rxCollectionsConfig: any = {};
  for (const [colName, config] of Object.entries(collectionsRegistry)) {
    rxCollectionsConfig[colName] = {
      schema: createRxSchema(colName, (config as any).rxSchema),
      migrationStrategies: createRxMigration((config as any).rxSchema),
    };
  }

  await db.addCollections(rxCollectionsConfig);

  for (const [colName, config] of Object.entries(collectionsRegistry)) {
    addZodHooks(
      db[colName],
      (config as any).zodSchemaLatest,
      (config as any).migrationSchema,
    );
  }

  return db;
}

const dbPromise = init("local");

async function getDB() {
  return await dbPromise;
}

export async function executeQuery<C extends CollectionName>(
  collectionName: C,
  mangoQuery: CollectionMangoQuery<C>,
): Promise<CollectionDocOutput<C>[]> {
  const db = await getDB();
  const result = await db[collectionName].find(mangoQuery).exec();

  return result.map((doc: any) => doc.toJSON());
}

export async function observeQuery<C extends CollectionName>(
  collectionName: C,
  mangoQuery: CollectionMangoQuery<C>,
  callback: (data: CollectionDocOutput<C>[]) => void,
) {
  const db = await getDB();

  const subscription = db[collectionName].find(mangoQuery).$.subscribe(
    (results: any[]) => {
      callback(results.map((doc) => doc.toJSON()));
    },
  );

  return proxy(() => {
    subscription.unsubscribe();
  });
}

export async function insert<C extends CollectionName>(
  collectionName: C,
  docData: CollectionDocInput<C>,
): Promise<CollectionDocOutput<C>> {
  const db = await getDB();
  const result = await db[collectionName].insert(docData);

  return result.toJSON();
}

export async function patchById<C extends CollectionName>(
  collectionName: C,
  id: string,
  patchData: Partial<CollectionDocInput<C>>,
): Promise<CollectionDocOutput<C>> {
  const db = await getDB();
  const doc = await db[collectionName].findOne(id).exec();

  if (!doc) {
    throw new Error(`Document with id ${id} not found in ${collectionName}`);
  }

  const result = await doc.patch(patchData);
  return result.toJSON();
}

export async function removeById<C extends CollectionName>(
  collectionName: C,
  id: string,
): Promise<boolean> {
  const db = await getDB();
  const doc = await db[collectionName].findOne(id).exec();

  if (!doc) return false;

  await doc.remove();
  return true;
}

export async function removeWhere<C extends CollectionName>(
  collectionName: C,
  mangoQuery: any,
): Promise<number> {
  const db = await getDB();

  const deletedDocs = await db[collectionName].find(mangoQuery).remove();
  return deletedDocs.length;
}
