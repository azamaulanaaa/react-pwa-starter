import { MessageChannel } from "node:worker_threads";
import { beforeEach, describe, expect, it } from "vitest";
import * as Comlink from "comlink";
import "fake-indexeddb/auto";

import "@/lib/comlink/index.ts";
import { createFileSystem } from "@/worker/fs/index.ts";
import { openStore } from "@/worker/fs/store.ts";

beforeEach(async () => {
  await (await openStore()).clear();
});

function createTestFs() {
  const fs = createFileSystem();

  const { port1, port2 } = new MessageChannel();
  Comlink.expose({ fs }, port1 as unknown as Comlink.Endpoint);
  return Comlink.wrap<any>(port2 as unknown as Comlink.Endpoint).fs;
}

describe("fs comlink bridge", () => {
  it("write, read, list and delete files over comlink-style endpoint", async () => {
    const remote = createTestFs();

    await remote.writeFile("docs/hello.txt", "hello world");

    expect(await remote.exists("docs/hello.txt")).toBe(true);
    expect(await remote.readFile("docs/hello.txt")).toBe("hello world");
    expect(await remote.listDir("docs")).toEqual(["hello.txt"]);
    expect(await remote.listDir("")).toEqual(["docs"]);

    await remote.writeFile("docs/nested/deep.txt", "deep");
    expect(await remote.listDir("docs")).toEqual([
      "hello.txt",
      "nested",
    ]);
    expect(await remote.listDir("docs/nested")).toEqual(["deep.txt"]);

    expect(await remote.deleteFile("docs/hello.txt")).toBe(true);
    expect(await remote.exists("docs/hello.txt")).toBe(false);
    await expect(remote.readFile("docs/hello.txt")).rejects.toThrow();

    const removed = await remote.removeDir("docs");
    expect(removed).toBe(1);
    expect(await remote.listDir("")).toEqual([]);
  });

  it("roundtrips binary content over comlink endpoint", async () => {
    const remote = createTestFs();

    const payload = new Uint8Array([0, 1, 2, 255]);
    await remote.writeFile("bin/blob", payload);

    const data = await remote.readFile("bin/blob");
    expect(data).toBeInstanceOf(Uint8Array);
    expect(Array.from(data as Uint8Array)).toEqual([0, 1, 2, 255]);
  });

  it("rejects path traversal", async () => {
    const remote = createTestFs();

    await expect(
      remote.readFile("../escape.txt"),
    ).rejects.toThrow(/traversal/i);
    await expect(
      remote.writeFile("a/../../escape.txt", "nope"),
    ).rejects.toThrow(/traversal/i);
  });

  it("streams directory listing updates over comlink endpoint", async () => {
    const remote = createTestFs();

    const readable = await remote.stream("docs");
    const reader = readable.getReader();

    const first = await reader.read();
    console.log("first", first);

    await remote.writeFile("docs/live.txt", "inserted after subscribe");
    console.log("written");

    const second = await Promise.race([
      reader.read(),
      new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 3000)),
    ]);
    console.log("second", second);
    await reader.cancel().catch(() => {});

    expect(second).not.toBe("TIMEOUT");
    expect((second as { value?: string[] }).value).toEqual(["live.txt"]);
  });
});
