import { MessageChannel } from "node:worker_threads";
import { beforeEach, describe, expect, it } from "vitest";
import * as Comlink from "comlink";
import "fake-indexeddb/auto";

import "@/lib/comlink/index.ts";
import { type SyncRemoteProxy } from "@/lib/comlink/index.ts";
import * as fs from "@/worker/fs/index.ts";
import { openStore } from "@/worker/fs/store.ts";

type RemoteFs = SyncRemoteProxy<typeof fs>;

beforeEach(async () => {
  await (await openStore()).clear();
});

function createTestFs(): RemoteFs {
  const { port1, port2 } = new MessageChannel();
  Comlink.expose(fs, port1 as unknown as Comlink.Endpoint);
  return Comlink.wrap(
    port2 as unknown as Comlink.Endpoint,
  ) as unknown as RemoteFs;
}

describe("fs comlink bridge", () => {
  it("uploads a single-part file and reads it back", async () => {
    const remote = createTestFs();
    const blob = new Blob(["hello world"], { type: "text/plain" });

    const id: string = await remote.InitUpload({
      file_size: blob.size,
      part_size: blob.size,
      file_total_parts: 1,
    });
    expect(id).toBeTruthy();

    await expect(
      remote.UploadPart(
        { file_id: "missing", file_total_part: 1, file_part: 0 },
        blob,
      ),
    ).rejects.toThrow(/not found/i);

    await remote.UploadPart(
      { file_id: id, file_total_part: 1, file_part: 0 },
      blob,
    );

    await remote.CompleteUpload(id, {
      name: "hello.txt",
      mimetype: "text/plain",
    });

    const file = await remote.Get(id);
    expect(file).not.toBeNull();
    expect(file!.name).toBe("hello.txt");
    expect(file!.size).toBe(blob.size);
    expect(await (file!.blob as Blob).text()).toBe("hello world");
  });

  it("rejects a part that does not match the registered size", async () => {
    const remote = createTestFs();
    const id: string = await remote.InitUpload({
      file_size: 4,
      part_size: 4,
      file_total_parts: 1,
    });

    await expect(
      remote.UploadPart(
        { file_id: id, file_total_part: 1, file_part: 0 },
        new Blob([new Uint8Array(3)]),
      ),
    ).rejects.toThrow(/mismatch/i);
  });

  it("cancels a session and deletes stored files", async () => {
    const remote = createTestFs();

    const id: string = await remote.InitUpload({
      file_size: 2,
      part_size: 2,
      file_total_parts: 1,
    });
    expect(await remote.CancelUpload(id)).toBe(true);
    await expect(
      remote.UploadPart(
        { file_id: id, file_total_part: 1, file_part: 0 },
        new Blob([new Uint8Array(2)]),
      ),
    ).rejects.toThrow(/not found/i);

    const doneId: string = await remote.InitUpload({
      file_size: 2,
      part_size: 2,
      file_total_parts: 1,
    });
    await remote.UploadPart(
      { file_id: doneId, file_total_part: 1, file_part: 0 },
      new Blob([new Uint8Array(2)]),
    );
    await remote.CompleteUpload(doneId, {
      name: "bin",
      mimetype: "application/octet-stream",
    });
    expect(await remote.Delete(doneId)).toBe(true);

    const file = await remote.Get(doneId);
    expect(file).toBeNull();
  });
});
