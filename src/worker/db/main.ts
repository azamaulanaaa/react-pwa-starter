import { addRxPlugin, createRxDatabase, MangoQuery, RxStorage } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBMigrationPlugin } from "rxdb/plugins/migration-schema";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { proxy, ProxyMarked } from "comlink";
import z from "zod";

import { initializeCollection } from "./lib/builder.ts";
import { ListCollectionBuilder } from "./schemas/list.schema.ts";

const builders = {
  list: ListCollectionBuilder,
} as const;

export type AppDocumentTypes = {
  [K in keyof typeof builders]: z.infer<
    ReturnType<(typeof builders)[K]["schema"]>
  >;
};

export type CollectionName = keyof AppDocumentTypes;
export type CollectionDocOutput<C extends CollectionName> = AppDocumentTypes[C];
export type CollectionDocInput<C extends CollectionName> = AppDocumentTypes[C];
export type CollectionMangoQuery<C extends CollectionName> = MangoQuery<
  AppDocumentTypes[C]
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

  await Promise.all(
    Object.values(builders).map((builder) => initializeCollection(builder, db)),
  );

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
  callback: ((data: CollectionDocOutput<C>[]) => void) & ProxyMarked,
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
