/**
 * The maximum length of the long image edge.
 */
export const IMAGE_MAX_EDGE = 720;

/**
 * The JPEG quality that the app uses first.
 */
export const IMAGE_JPEG_QUALITY = 0.7;

/**
 * The maximum image size in bytes.
 */
export const IMAGE_MAX_BYTES = 300 * 1024;

/**
 * The lowest JPEG quality that the app uses.
 */
export const IMAGE_MIN_QUALITY = 0.4;

export type ImageSize = {
  width: number;
  height: number;
};

export type JpegSource = {
  /** The bitmap, video, or image that the canvas draws. */
  source: CanvasImageSource;
  /** The intrinsic frame width. */
  width: number;
  /** The intrinsic frame height. */
  height: number;
};

export type JpegCanvas = {
  /**
   * Draws the source into the canvas.
   */
  draw: (source: CanvasImageSource) => void;
  /**
   * Encodes the canvas and returns the result.
   */
  encode: (type: string, quality: number) => Promise<Blob>;
};

export type JpegCanvasFactory = (size: ImageSize) => JpegCanvas | null;

export type JpegOptions = {
  /** The maximum length of the long edge. */
  maxEdge?: number;
  /** The first JPEG quality. */
  quality?: number;
  /** The maximum file size in bytes. */
  maxBytes?: number;
  /** A test can replace the canvas factory. */
  createCanvas?: JpegCanvasFactory;
};

/**
 * Scales an image to fit inside the long edge.
 * The function keeps the aspect ratio.
 * The function does not enlarge a small image.
 */
export function scaleSize(
  width: number,
  height: number,
  maxEdge: number = IMAGE_MAX_EDGE,
): ImageSize {
  const longEdge = Math.max(width, height);

  if (longEdge <= 0) {
    return { width: 1, height: 1 };
  }

  if (longEdge <= maxEdge) {
    return { width, height };
  }

  const ratio = maxEdge / longEdge;

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Returns a JPEG quality that can fit the byte limit.
 * The function returns the current quality when the image is small enough.
 * The function does not go below the minimum quality.
 */
export function jpegQualityForSize(
  bytes: number,
  quality: number = IMAGE_JPEG_QUALITY,
  maxBytes: number = IMAGE_MAX_BYTES,
): number {
  if (bytes <= maxBytes) {
    return quality;
  }

  if (maxBytes <= 0) {
    return Math.min(quality, IMAGE_MIN_QUALITY);
  }

  const scaled = Math.floor((quality * maxBytes * 100) / bytes) / 100;
  const floor = Math.min(quality, IMAGE_MIN_QUALITY);

  return Math.max(floor, Math.min(quality, scaled));
}

function createCanvas(size: ImageSize): JpegCanvas | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  return {
    draw(source) {
      context.drawImage(source, 0, 0, size.width, size.height);
    },
    encode(type, quality) {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
              return;
            }

            reject(
              new Error(
                "The image encode failed. The canvas returned no data.",
              ),
            );
          },
          type,
          quality,
        );
      });
    },
  };
}

/**
 * Draws a source into a canvas and encodes it as JPEG.
 * The function scales the image and lowers the quality until the size fits.
 * The new encode removes the source metadata, including the EXIF data.
 */
export async function encodeJpeg(
  source: JpegSource,
  options: JpegOptions = {},
): Promise<Blob> {
  const maxBytes = options.maxBytes ?? IMAGE_MAX_BYTES;
  const size = scaleSize(
    source.width,
    source.height,
    options.maxEdge ?? IMAGE_MAX_EDGE,
  );
  const canvas = (options.createCanvas ?? createCanvas)(size);

  if (!canvas) {
    throw new Error("The image capture failed. The canvas is not available.");
  }

  canvas.draw(source.source);

  let quality = options.quality ?? IMAGE_JPEG_QUALITY;
  let blob = await canvas.encode("image/jpeg", quality);

  while (blob.size > maxBytes) {
    const nextQuality = jpegQualityForSize(blob.size, quality, maxBytes);

    if (nextQuality === quality) {
      break;
    }

    quality = nextQuality;
    blob = await canvas.encode("image/jpeg", quality);
  }

  return blob;
}

/**
 * Decodes an image file and encodes it as JPEG.
 * The new encode removes the source metadata, including the EXIF data.
 */
export async function blobToJpeg(
  source: Blob,
  options: JpegOptions = {},
): Promise<Blob> {
  if (typeof createImageBitmap !== "function") {
    throw new Error(
      "The image load failed. The browser cannot decode the image.",
    );
  }

  const bitmap = await createImageBitmap(source);

  try {
    return await encodeJpeg(
      { source: bitmap, width: bitmap.width, height: bitmap.height },
      options,
    );
  } finally {
    bitmap.close();
  }
}
