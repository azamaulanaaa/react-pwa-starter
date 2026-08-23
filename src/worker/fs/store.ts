import { createStorage, type Storage } from "unstorage";
import indexedDbDriver from "unstorage/drivers/indexedb";

const storage = createStorage({
  driver: indexedDbDriver({ dbName: "fs" }),
});

export function openStore(): Promise<Storage> {
  return Promise.resolve(storage);
}
