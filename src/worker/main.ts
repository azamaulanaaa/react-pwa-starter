import "@/lib/comlink/index.ts";
import * as Comlink from "comlink";

import { dbMain } from "@/worker/db/index.ts";
import * as fs from "@/worker/fs/index.ts";

interface SharedWorkerScope {
  onconnect: ((event: MessageEvent) => void) | null;
}

// The global scope of a dedicated worker is the message channel.
// `wrap(worker)` on the main thread posts to `self.onmessage` directly.
// A no-arg `Comlink.expose` uses `self.onmessage` by default.
function exposeOnSelf<T>(api: T): void {
  Comlink.expose(api);
}

// The global scope of a SharedWorker is not a channel.
// Each tab connection arrives as an `onconnect` event that carries a fresh MessagePort.
// A tab sends messages only to its own port and never to `self`.
// Exposing inside `onconnect` gives each connecting tab its own proxy into this single shared instance.
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
