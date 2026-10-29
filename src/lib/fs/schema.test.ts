import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  MAX_SINGLE_PART_SIZE,
  UploadInitSchema,
  type UploadInit,
} from "@/lib/fs/schema.ts";

function decode(input: UploadInit) {
  return Effect.runPromise(Schema.decodeEffect(UploadInitSchema)(input));
}

describe("upload declaration schema", () => {
  it("rejects a part size that is not a multiple of 1 KiB", async () => {
    await expect(
      decode({ file_size: 2500, part_size: 1000, file_total_parts: 3 }),
    ).rejects.toThrow(/part size/i);
  });

  it("rejects a single part that is larger than 10 MiB", async () => {
    const size = MAX_SINGLE_PART_SIZE + 1;

    await expect(
      decode({ file_size: size, part_size: size, file_total_parts: 1 }),
    ).rejects.toThrow(/single part/i);
  });

  it("rejects a part count that does not match the file size", async () => {
    await expect(
      decode({ file_size: 2500, part_size: 1024, file_total_parts: 5 }),
    ).rejects.toThrow(/part count/i);
  });

  it("accepts a multipart declaration with the correct part count", async () => {
    await expect(
      decode({ file_size: 2500, part_size: 1024, file_total_parts: 3 }),
    ).resolves.toEqual({
      file_size: 2500,
      part_size: 1024,
      file_total_parts: 3,
    });
  });
});
