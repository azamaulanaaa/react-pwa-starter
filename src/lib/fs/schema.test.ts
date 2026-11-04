import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  MAX_MULTIPART_PARTS,
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

  it("accepts a multipart declaration with the correct part count", async () => {
    await expect(
      decode({ file_size: 2500, part_size: 1024, file_total_parts: 3 }),
    ).resolves.toEqual({
      file_size: 2500,
      part_size: 1024,
      file_total_parts: 3,
    });
  });

  it.each([2, 4, 5])(
    "rejects a part count of %i for the file size 2500 and the part size 1024",
    async (fileTotalParts) => {
      await expect(
        decode({
          file_size: 2500,
          part_size: 1024,
          file_total_parts: fileTotalParts,
        }),
      ).rejects.toThrow(/part count/i);
    },
  );

  it("accepts a multipart declaration with 10000 parts", async () => {
    const partSize = 1024;
    const fileSize = MAX_MULTIPART_PARTS * partSize;

    await expect(
      decode({
        file_size: fileSize,
        part_size: partSize,
        file_total_parts: MAX_MULTIPART_PARTS,
      }),
    ).resolves.toEqual({
      file_size: fileSize,
      part_size: partSize,
      file_total_parts: MAX_MULTIPART_PARTS,
    });
  });

  it("rejects a multipart declaration with 10001 parts", async () => {
    const partSize = 1024;
    const fileSize = (MAX_MULTIPART_PARTS + 1) * partSize;

    await expect(
      decode({
        file_size: fileSize,
        part_size: partSize,
        file_total_parts: MAX_MULTIPART_PARTS + 1,
      }),
    ).rejects.toThrow(/part count/i);
  });

  it("accepts a single part of exactly 10 MiB", async () => {
    await expect(
      decode({
        file_size: MAX_SINGLE_PART_SIZE,
        part_size: MAX_SINGLE_PART_SIZE,
        file_total_parts: 1,
      }),
    ).resolves.toEqual({
      file_size: MAX_SINGLE_PART_SIZE,
      part_size: MAX_SINGLE_PART_SIZE,
      file_total_parts: 1,
    });
  });

  it("rejects a single part that is larger than 10 MiB", async () => {
    const size = MAX_SINGLE_PART_SIZE + 1;

    await expect(
      decode({ file_size: size, part_size: size, file_total_parts: 1 }),
    ).rejects.toThrow(/single part/i);
  });

  it("rejects a single part when the part size does not equal the file size", async () => {
    await expect(
      decode({ file_size: 2048, part_size: 1024, file_total_parts: 1 }),
    ).rejects.toThrow(/part size must equal the file size/i);
  });
});
