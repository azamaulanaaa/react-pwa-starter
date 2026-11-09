import { describe, expect, it } from "vitest";

import {
  createWorkerImageUpload,
  type ImageUploadEvent,
  type ImageUploadWorker,
} from "@/components/editor/image-upload.ts";

/** Returns one worker with a fixed upload stream. */
function createWorker(events: ImageUploadEvent[]): ImageUploadWorker {
  return {
    fs: {
      Upload: () =>
        new ReadableStream<ImageUploadEvent>({
          start(controller) {
            for (const event of events) controller.enqueue(event);
            controller.close();
          },
        }),
    },
  };
}

const FILE = new File(["image"], "cat.png", { type: "image/png" });

describe("createWorkerImageUpload", () => {
  it("resolves on Complete and reports the progress", async () => {
    const worker = createWorker([
      { _tag: "Init", fileId: "file_01" },
      { _tag: "Progress", percent: 50 },
      { _tag: "Progress", percent: 100 },
      { _tag: "Complete", fileId: "file_01" },
    ]);
    const progress: number[] = [];
    const handler = createWorkerImageUpload(worker);

    await expect(
      handler(FILE, {
        onProgress: (percent) => progress.push(percent),
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ alt: "cat.png", id: "file_01" });

    expect(progress).toEqual([50, 100]);
  });

  it("rejects on an error event", async () => {
    const worker = createWorker([
      { _tag: "Init", fileId: "file_01" },
      { _tag: "Error", message: "The test upload failed." },
    ]);
    const handler = createWorkerImageUpload(worker);

    await expect(
      handler(FILE, {
        onProgress: () => undefined,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("The test upload failed.");
  });

  it("rejects when the stream ends before Complete", async () => {
    const worker = createWorker([{ _tag: "Init", fileId: "file_01" }]);
    const handler = createWorkerImageUpload(worker);

    await expect(
      handler(FILE, {
        onProgress: () => undefined,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("The image upload ended before it completed.");
  });
});
