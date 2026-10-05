import { createStorage } from "unstorage";
import indexedDbDriver from "unstorage/drivers/indexedb";

const storage = createStorage({
  driver: indexedDbDriver({ dbName: "fs" }),
});

export const fsStorage = storage;
