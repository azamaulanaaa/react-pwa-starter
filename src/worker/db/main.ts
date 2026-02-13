import { addRxPlugin, createRxDatabase, RxStorage } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBMigrationPlugin } from "rxdb/plugins/migration-schema";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import { createRxMigration, createRxSchema } from "./lib/rx_schema.ts";
import { addZodHooks } from "./lib/add_zod_hook.ts";
import {
  ListMigrationSchema,
  ListSchema,
  ListSchemaLatest,
} from "./schemas/list.schema.ts";

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

  await db.addCollections({
    list: {
      schema: createRxSchema("list", ListSchema),
      migrationStrategies: createRxMigration(ListSchema),
    },
  });

  addZodHooks(db.list, ListSchemaLatest, ListMigrationSchema);

  return db;
}

const dbPromise = init("local");

async function getDB() {
  return await dbPromise;
}

export async function getAllListItems() {
  const db = await getDB();
  const result = await db.list.find().exec();
  const data = result.map((doc: any) => doc.toJSON());

  return data as z.infer<typeof ListSchemaLatest>[];
}

export async function addListItem(value: string) {
  const db = await getDB();
  const result = await db.list.insert({
    version: 1,
    id: uuidv7(),
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    content: value,
  });

  return result.toJSON() as z.infer<typeof ListSchemaLatest>;
}
