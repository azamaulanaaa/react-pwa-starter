import { afterEach, describe, expect, it, vi } from "vitest";

import {
  blobToJpeg,
  encodeJpeg,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_EDGE,
  jpegQualityForSize,
  scaleSize,
  type ImageSize,
  type JpegCanvas,
  type JpegCanvasFactory,
  type JpegSource,
} from "@/lib/image.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

type FakeCanvasOptions = {
  sizes?: ImageSize[];
  qualities?: string[];
};

function fakeCanvas(
  encode: (quality: number) => Blob,
  options: FakeCanvasOptions = {},
): JpegCanvasFactory {
  return (size) => {
    options.sizes?.push(size);

    return {
      draw: () => {},
      encode: async (type, quality) => {
        options.qualities?.push(`${type}:${quality}`);
        return encode(quality);
      },
    } satisfies JpegCanvas;
  };
}

function source(width: number, height: number): JpegSource {
  return { source: {} as CanvasImageSource, width, height };
}

function jpegOfSize(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
}

describe("scaleSize", () => {
  it("scales a wide image to 720 pixels on the long edge", () => {
    expect(scaleSize(4000, 3000)).toEqual({ width: 720, height: 540 });
  });

  it("scales a tall image to 720 pixels on the long edge", () => {
    expect(scaleSize(3000, 4000)).toEqual({ width: 540, height: 720 });
  });

  it("keeps a small image at the original size", () => {
    expect(scaleSize(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it("uses the configured long edge", () => {
    expect(scaleSize(1600, 800, 400)).toEqual({ width: 400, height: 200 });
  });
});

describe("jpegQualityForSize", () => {
  it("keeps the first quality when the image is under the limit", () => {
    expect(jpegQualityForSize(IMAGE_MAX_BYTES - 1)).toBe(0.7);
  });

  it("lowers the quality when the image is over the limit", () => {
    expect(jpegQualityForSize(IMAGE_MAX_BYTES * 1.2)).toBeLessThan(0.7);
  });

  it("does not go below the minimum quality", () => {
    expect(jpegQualityForSize(IMAGE_MAX_BYTES * 100)).toBe(0.4);
  });
});

describe("encodeJpeg", () => {
  it("draws the image at 720 pixels and encodes it at quality 0.7", async () => {
    const sizes: ImageSize[] = [];
    const qualities: string[] = [];
    const createCanvas = fakeCanvas(() => jpegOfSize(100 * 1024), {
      sizes,
      qualities,
    });

    await encodeJpeg(source(4000, 3000), { createCanvas });

    expect(sizes).toEqual([{ width: IMAGE_MAX_EDGE, height: 540 }]);
    expect(qualities).toEqual(["image/jpeg:0.7"]);
  });

  it("removes the EXIF data from the captured image", async () => {
    const close = vi.fn();
    const input = new Blob(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10])],
      { type: "image/jpeg" },
    );
    const output = jpegOfSize(80 * 1024);
    const qualities: string[] = [];

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        width: 1600,
        height: 1200,
        close,
      })),
    );

    const result = await blobToJpeg(input, {
      createCanvas: fakeCanvas(() => output, { qualities }),
    });

    expect(result).toBe(output);
    expect(result).not.toBe(input);
    expect(result.type).toBe("image/jpeg");
    expect(qualities).toEqual(["image/jpeg:0.7"]);
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps the image under 300 kilobytes", async () => {
    const qualities: number[] = [];
    const createCanvas = fakeCanvas(
      (quality) => {
        qualities.push(quality);
        return jpegOfSize(quality >= 0.7 ? 400 * 1024 : 200 * 1024);
      },
      { qualities: [] },
    );

    const result = await encodeJpeg(source(4000, 3000), { createCanvas });

    expect(result.size).toBeLessThanOrEqual(IMAGE_MAX_BYTES);
    expect(qualities.at(0)).toBe(0.7);
    expect(qualities.at(-1)).toBeLessThan(0.7);
  });
});
