import initOxkv, { BTreeStore } from "oxkv";
import wasmUrl from "oxkv/oxkv_bg.wasm?url";

const instances = new Map<string, Promise<BTreeStore>>();

export function openStore(name: string): Promise<BTreeStore> {
  let instance = instances.get(name);

  if (!instance) {
    instance = (async () => {
      await initOxkv(wasmUrl);
      return new BTreeStore();
    })();
    instances.set(name, instance);
  }

  return instance;
}
