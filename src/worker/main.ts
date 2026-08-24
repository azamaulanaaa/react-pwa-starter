import "@/lib/comlink/index.ts";
import * as Comlink from "comlink";

import { dbMain } from "@/worker/db/index.ts";
import * as fs from "@/worker/fs/index.ts";

interface SharedWorkerScope {
  onconnect: ((event: MessageEvent) => void) | null;
}

// A dedicated worker's global scope IS the message channel: `wrap(worker)` on
// the main thread posts straight to `self.onmessage`, which a no-arg
// Comlink.expose hooks by default.
function exposeOnSelf<T>(api: T): void {
  Comlink.expose(api);
}

// A SharedWorker's global scope is NOT a channel. Each tab connection arrives
// as an `onconnect` event carrying a fresh MessagePort; tabs only talk to
// their own port, never to `self`. Exposing inside onconnect gives every
// connecting tab its own proxy into this single shared instance.
function exposePerConnection<T>(api: T): void {
  const scope = self as unknown as SharedWorkerScope;

  scope.onconnect = (event) => {
    Comlink.expose(api, event.ports[0]);
  };
}

const api = { db: dbMain, fs };

if ("onconnect" in self) {
  exposePerConnection(api);
} else {
  exposeOnSelf(api);
}

export { dbMain as db, fs };
