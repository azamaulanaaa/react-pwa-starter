import "fake-indexeddb/auto";
import { MessageChannel } from "node:worker_threads";
import { beforeAll, describe, expect, it } from "vitest";

import "@/lib/comlink/index.ts";
import * as Comlink from "comlink";
import { dbMain } from "@/worker/db/index.ts";
import { setupOxkv } from "@/worker/db/oxkv-wasm.ts";

describe("comlink bridge", () => {
  beforeAll(setupOxkv);

  it("set over comlink-style endpoint", async () => {
    const { port1, port2 } = new MessageChannel();
    Comlink.expose({ task: dbMain.task }, port1 as unknown as Comlink.Endpoint);

    // deno-lint-ignore no-explicit-any
    const remote = Comlink.wrap(port2 as unknown as Comlink.Endpoint) as any;

    await remote.task.set("test-id-1", {
      description: "hello",
      is_done: false,
    });

    const got = await remote.task.get("test-id-1");
    expect(got.description).toBe("hello");
  });

  it("watch over comlink endpoint", async () => {
    const { port1, port2 } = new MessageChannel();
    Comlink.expose({ task: dbMain.task }, port1 as unknown as Comlink.Endpoint);
    // deno-lint-ignore no-explicit-any
    const remote = Comlink.wrap(port2 as unknown as Comlink.Endpoint) as any;

    const readable = await remote.task.watch({ direction: "next" });
    const reader = readable.getReader();
    const first = await reader.read();

    await remote.task.set(`live-${Date.now()}`, {
      description: "inserted after subscribe",
      is_done: false,
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
