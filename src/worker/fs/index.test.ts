import { MessageChannel } from "node:worker_threads";
import { beforeEach, describe, expect, it } from "vitest";
import * as Comlink from "comlink";
import { v7 as randomUUID } from "uuid";
import "fake-indexeddb/auto";

import "@/lib/comlink/index.ts";
import { type SyncRemoteProxy } from "@/lib/comlink/index.ts";
import * as fs from "@/worker/fs/index.ts";
import { fsStorage } from "@/worker/fs/store.ts";

type RemoteFs = SyncRemoteProxy<typeof fs>;

beforeEach(async () => {
  await fsStorage.clear();
});

function createTestFs(): RemoteFs {
  const { port1, port2 } = new MessageChannel();
  Comlink.expose(fs, port1 as unknown as Comlink.Endpoint);
  return Comlink.wrap(
    port2 as unknown as Comlink.Endpoint,
  ) as unknown as RemoteFs;
}

async function collectStream<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const values: T[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return values;
    values.push(value);
  }
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

  it("accepts a multi-part declaration whose size is not a multiple of part_size", async () => {
    const remote = createTestFs();

    const id: string = await remote.InitUpload({
      file_size: 2500,
      part_size: 1024,
      file_total_parts: 3,
    });
    expect(id).toBeTruthy();

    await expect(
      remote.InitUpload({
        file_size: 2500,
        part_size: 1024,
        file_total_parts: 5,
      }),
    ).rejects.toThrow(/inconsistent math/i);
  });

  it("streams a multi-part upload whose size is not a multiple of part_size", async () => {
    const remote = createTestFs();
    const partSize = 1024;
    const bytes = new Uint8Array(2500).map((_, i) => (i * 31) % 256);
    const blob = new Blob([bytes], { type: "application/octet-stream" });

    const stream = await remote.Upload("blob.bin", blob, partSize);
    const events = await collectStream<{ _tag: string; fileId: string }>(
      stream,
    );

    expect(events.at(-1)?._tag).toBe("Complete");
    const fileId = events[0].fileId;

    const file = await remote.Get(fileId);
    expect(file).not.toBeNull();
    expect(file!.size).toBe(blob.size);

    const uploaded = new Uint8Array(await (file!.blob as Blob).arrayBuffer());
    expect(uploaded).toEqual(bytes);
  });

  it("fails completion and keeps the session when a part is missing", async () => {
    const remote = createTestFs();
    const store = fsStorage;
    const partSize = 1024;
    const size = 2500;
    const totalParts = 3;

    const id: string = await remote.InitUpload({
      file_size: size,
      part_size: partSize,
      file_total_parts: totalParts,
    });

    // Deliberately skip part 1 to simulate a lost part.
    for (const i of [0, 2]) {
      const start = i * partSize;
      await remote.UploadPart(
        { file_id: id, file_total_part: totalParts, file_part: i },
        blobOf(start, Math.min(partSize, size - start)),
      );
    }

    await expect(
      remote.CompleteUpload(id, { name: "part.bin", mimetype: "text/plain" }),
    ).rejects.toThrow(/assembly failed/i);

    expect(await store.getItem(`files:${id}:metadata`)).toBeNull();
    expect(await store.getItemRaw(`files:${id}:binary`)).toBeNull();

    expect(await store.getItem(`uploads:${id}:metadata`)).toMatchObject({
      file_size: size,
      file_total_parts: totalParts,
    });
    expect(await store.getItemRaw(`uploads:${id}:part:0`)).not.toBeNull();
    expect(await store.getItemRaw(`uploads:${id}:part:2`)).not.toBeNull();
  });

  it("fails completion with an FsError when the session is gone", async () => {
    const remote = createTestFs();
    const store = fsStorage;

    // An unknown id resolves to null, which must surface as a typed FsError
    // rather than a TypeError from dereferencing a null session.
    await expect(
      remote.CompleteUpload(randomUUID(), {
        name: "ghost.bin",
        mimetype: "text/plain",
      }),
    ).rejects.toThrow(/session missing or already finalized/i);

    // Cancelled sessions are gone too, and must fail the same way.
    const id: string = await remote.InitUpload({
      file_size: 4,
      part_size: 4,
      file_total_parts: 1,
    });
    await remote.UploadPart(
      { file_id: id, file_total_part: 1, file_part: 0 },
      new Blob([new Uint8Array([1, 2, 3, 4])]),
    );
    await remote.CompleteUpload(id, { name: "ok.bin", mimetype: "text/plain" });

    await expect(
      remote.CompleteUpload(id, { name: "again.bin", mimetype: "text/plain" }),
    ).rejects.toThrow(/session missing or already finalized/i);

    expect(await store.getItem(`uploads:${id}:metadata`)).toBeNull();
  });
});

function blobOf(start: number, length: number): Blob {
  const bytes = new Uint8Array(length).map((_, i) => (start + i) % 256);
  return new Blob([bytes], { type: "application/octet-stream" });
}
