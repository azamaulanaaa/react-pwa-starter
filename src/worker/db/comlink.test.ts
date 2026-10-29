import "fake-indexeddb/auto";
import { MessageChannel } from "node:worker_threads";
import { beforeAll, describe, expect, it } from "vitest";

import "@/lib/comlink/index.ts";
import * as Comlink from "comlink";
import { createTestDatabase } from "@/worker/db/test-support.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";

const dbMain = createTestDatabase();

describe("comlink bridge", () => {
  beforeAll(setupOxkv);

  it("sets a document over a comlink endpoint", async () => {
    const { port1, port2 } = new MessageChannel();
    Comlink.expose({ item: dbMain.item }, port1 as unknown as Comlink.Endpoint);

    const remote = Comlink.wrap(port2 as unknown as Comlink.Endpoint) as any;

    await remote.item.set("test-id-1", {
      label: "hello",
      done: false,
    });

    const got = await remote.item.get("test-id-1");
    expect(got.label).toBe("hello");
  });

  it("watches a table over a comlink endpoint", async () => {
    const { port1, port2 } = new MessageChannel();
    Comlink.expose({ item: dbMain.item }, port1 as unknown as Comlink.Endpoint);
    const remote = Comlink.wrap(port2 as unknown as Comlink.Endpoint) as any;

    const readable = await remote.item.watch({ direction: "next" });
    const reader = readable.getReader();
    const first = await reader.read();

    await remote.item.set(`live-${Date.now()}`, {
      label: "inserted after subscribe",
      done: false,
    });

    const second = await Promise.race([
      reader.read(),
      new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 3000)),
    ]);
    await reader.cancel().catch(() => {});
    expect(Array.isArray(first.value)).toBe(true);
    expect(second).not.toBe("TIMEOUT");
  });
});
