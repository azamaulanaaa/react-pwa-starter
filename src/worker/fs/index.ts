import { Effect, Ref, Schema, Stream } from "effect";
import { v7 as randomUUID } from "uuid";

import { FsError } from "@/worker/fs/error.ts";
import { openStore } from "@/worker/fs/store.ts";

const db = await openStore();

const FileIdSchema = Schema.NonEmptyString;
export type FileId = Schema.Schema.Type<typeof FileIdSchema>;

const FileMetadataSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  mimetype: Schema.NonEmptyString,
});
export type FileMetadata = Schema.Schema.Type<typeof FileMetadataSchema>;

export const MetadataUploadSchema = Schema.Struct({
  file_size: Schema.NonNegativeInt,
  part_size: Schema.NonNegativeInt,
  file_total_parts: Schema.NonNegativeInt,
}).pipe(
  Schema.filter((data) => {
    if (data.file_size === 0) return "file_size cannot be empty";
    if (data.part_size === 0) return "part_size cannot be zero";
    if (data.file_total_parts === 0) return "total_parts cannot be zero";

    if (data.file_total_parts === 1) {
      if (data.part_size != data.file_size) {
        return `For a single-part upload, part_size (${data.part_size}) must be equal to the file_size (${data.file_size})`;
      }
      if (data.file_size > 10 * 1024 * 1024) {
        return `For a single-part upload, cannot bigger than 10 MB`;
      }
    } else {
      const isMultipleOf1KB = data.part_size % 1024 === 0;
      const withinBounds = data.part_size <= 524288;

      if (!isMultipleOf1KB || !withinBounds) {
        return "part_size must be a power-of-two multiple of 1 KB up to 512 KB (e.g., 131072, 262144, 524288)";
      }

      const expectedParts = Math.ceil(data.file_size / data.part_size);
      if (data.file_total_parts !== expectedParts) {
        return `Inconsistent math: file_total_parts must be exactly ${expectedParts} for a file of this size split by ${data.part_size} bytes`;
      }
    }

    // Multi-part: ensure total_parts * part_size == file_size
    if (data.file_total_parts > 1) {
      const product = data.file_total_parts * data.part_size;
      if (product !== data.file_size) {
        return `Inconsistent math: file_total_parts (${data.file_total_parts}) * part_size (${data.part_size}) must equal file_size (${data.file_size})`;
      }
    }

    return;
  }),
);
export type MetadataUpload = Schema.Schema.Type<typeof MetadataUploadSchema>;

const MetadataUploadPartSchema = Schema.Struct({
  file_id: FileIdSchema,
  file_total_part: Schema.NonNegativeInt,
  file_part: Schema.NonNegativeInt,
});
export type MetadataUploadPart = Schema.Schema.Type<
  typeof MetadataUploadPartSchema
>;

export const InitUpload = (metadata: MetadataUpload) =>
  Effect.gen(function* () {
    const vMetadata = yield* Schema.decode(MetadataUploadSchema)(
      metadata,
    )
      .pipe(Effect.mapError((error) => new FsError({ error })));

    const id = randomUUID();

    yield* Effect.tryPromise({
      try: () => db.setItem(`uploads:${id}:metadata`, { id, ...vMetadata }),
      catch: (error) => new FsError({ error }),
    });

    return id;
  });

export const UploadPart = (metadata: MetadataUploadPart, blob: Blob) =>
  Effect.gen(function* () {
    const { metadata: vMetadata, blob: vBlob } = yield* Schema.decode(
      Schema.Struct({
        metadata: MetadataUploadPartSchema,
        blob: Schema.instanceOf(Blob),
      }),
    )({ metadata, blob }).pipe(
      Effect.mapError((error) => new FsError({ error })),
    );

    const session = yield* Effect.tryPromise({
      try: () =>
        db.getItem(`uploads:${vMetadata.file_id}:metadata`) as Promise<
          MetadataUpload
        >,
      catch: () => new FsError({ error: "Upload session not found." }),
    });
    if (!session) {
      return yield* Effect.fail(
        new FsError({ error: "Upload session not found." }),
      );
    }

    if (vMetadata.file_total_part !== session.file_total_parts) {
      return yield* Effect.fail(
        new FsError({
          error: "Part count mismatch with initial registration.",
        }),
      );
    }
    if (vMetadata.file_part >= session.file_total_parts) {
      return yield* Effect.fail(
        new FsError({ error: "Part index out of bounds." }),
      );
    }

    const totalParts = session.file_total_parts;
    const totalSize = session.file_size;
    const currentPartIndex = vMetadata.file_part;
    const basePartSize = session.part_size;

    let expectedSize = basePartSize;
    if (currentPartIndex === totalParts - 1) {
      const bytesUploadedBefore = basePartSize * currentPartIndex;
      expectedSize = totalSize - bytesUploadedBefore;
    }

    // Reject any part whose blob exceeds what the declared total allows for this index
    if (
      totalParts > 0 &&
      vBlob.size > Math.min(totalSize, totalParts * basePartSize)
    ) {
      return yield* Effect.fail(
        new FsError({
          error:
            `Blob size mismatch for part ${currentPartIndex}. Expected at most ${
              Math.min(totalSize, totalParts * basePartSize)
            } bytes (declared total ${totalSize} / parts ${totalParts}), but received ${vBlob.size} bytes.`,
        }),
      );
    }

    if (vBlob.size !== expectedSize) {
      return yield* Effect.fail(
        new FsError({
          error:
            `Blob size mismatch for part ${currentPartIndex}. Expected ${expectedSize} bytes, but received ${vBlob.size} bytes.`,
        }),
      );
    }

    yield* Effect.tryPromise({
      try: async () => {
        const buffer = await vBlob.arrayBuffer();
        await db.setItemRaw(
          `uploads:${vMetadata.file_id}:part:${vMetadata.file_part}`,
          new Uint8Array(buffer),
        );
      },
      catch: (error) => new FsError({ error }),
    });

    return true;
  });

export const CompleteUpload = (id: FileId, metadata: FileMetadata) =>
  Effect.gen(function* () {
    const { id: vId, metadata: vMetadata } = yield* Schema.decode(
      Schema.Struct({ id: FileIdSchema, metadata: FileMetadataSchema }),
    )({ id, metadata }).pipe(
      Effect.mapError((error) => new FsError({ error })),
    );

    const session = yield* Effect.tryPromise({
      try: () =>
        db.getItem(`uploads:${vId}:metadata`) as Promise<
          { file_size: number; file_total_parts: number }
        >,
      catch: () =>
        new FsError({ error: "Session missing or already finalized." }),
    });
    const indices = Array.from(
      { length: session.file_total_parts },
      (_, i) => i,
    );

    yield* Effect.tryPromise({
      try: async () => {
        const buffers: Uint8Array[] = [];
        for (const i of indices) {
          const chunk = await db.getItemRaw(`uploads:${vId}:part:${i}`);
          if (chunk) buffers.push(chunk as Uint8Array);
        }

        const totalLength = buffers.reduce((acc, val) => acc + val.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const buffer of buffers) {
          combined.set(buffer, offset);
          offset += buffer.length;
        }

        await db.setItemRaw(`files:${vId}:binary`, combined);
      },
      catch: (error) => new FsError({ error: `Assembly failed: ${error}` }),
    });

    yield* Effect.tryPromise({
      try: () =>
        db.setItem(`files:${vId}:metadata`, {
          id: vId,
          name: vMetadata.name,
          mimetype: vMetadata.mimetype,
          size: session.file_size,
        }),
      catch: (error) => new FsError({ error }),
    });

    yield* Effect.tryPromise({
      try: async () => {
        await db.removeItem(`uploads:${vId}:metadata`);
        for (const i of indices) {
          await db.removeItem(`uploads:${vId}:part:${i}`);
        }
      },
      catch: (error) => new FsError({ error }),
    });

    return true;
  });

export const CancelUpload = (id: FileId) =>
  Effect.gen(function* () {
    const vId = yield* Schema.decode(FileIdSchema)(id).pipe(
      Effect.mapError((error) => new FsError({ error })),
    );

    const session = yield* Effect.tryPromise({
      try: () =>
        db.getItem(`uploads:${vId}:metadata`) as Promise<
          { file_total_parts: number } | null
        >,
      catch: (error) => new FsError({ error }),
    });

    if (!session) {
      return yield* Effect.fail(
        new FsError({ error: "Upload session not found or already removed." }),
      );
    }

    yield* Effect.tryPromise({
      try: async () => {
        const indices = Array.from(
          { length: session.file_total_parts },
          (_, i) => i,
        );
        for (const i of indices) {
          await db.removeItem(`uploads:${vId}:part:${i}`);
        }

        await db.removeItem(`uploads:${vId}:metadata`);
      },
      catch: (error) => new FsError({ error: `Cancellation failed: ${error}` }),
    });

    return true;
  });

export const Delete = (id: FileId) =>
  Effect.gen(function* () {
    const vId = yield* Schema.decode(FileIdSchema)(id).pipe(
      Effect.mapError((error) => new FsError({ error })),
    );

    yield* Effect.tryPromise({
      try: async () => {
        await db.removeItem(`files:${vId}:binary`);
        await db.removeItem(`files:${vId}:metadata`);
      },
      catch: (error) => new FsError({ error }),
    });

    return true;
  });

export const Get = (id: FileId) =>
  Effect.gen(function* () {
    const vId = yield* Schema.decode(FileIdSchema)(id).pipe(
      Effect.mapError((error) => new FsError({ error })),
    );

    const metadata = yield* Effect.tryPromise({
      try: () =>
        db.getItem(`files:${vId}:metadata`) as Promise<
          { id: string; name: string; mimetype: string; size: number }
        >,
      catch: (error) => new FsError({ error }),
    });

    if (metadata === null) {
      return null;
    }

    const file = yield* Effect.tryPromise({
      try: async () => {
        const rawBuffer = await db.getItemRaw(`files:${vId}:binary`);
        if (!rawBuffer) throw new Error("File binary content not found.");
        let safeBuffer: ArrayBuffer;

        if (
          typeof SharedArrayBuffer !== "undefined" &&
          rawBuffer instanceof SharedArrayBuffer
        ) {
          safeBuffer = new ArrayBuffer(rawBuffer.byteLength);
          new Uint8Array(safeBuffer).set(new Uint8Array(rawBuffer));
        } else {
          safeBuffer = rawBuffer as ArrayBuffer;
        }

        return new Blob([safeBuffer], {
          type: metadata.mimetype,
        });
      },
      catch: (error) => new FsError({ error }),
    });

    return {
      ...metadata,
      blob: file,
    };
  });

export class UploadInitEvent
  extends Schema.TaggedClass<UploadInitEvent>()("Init", {
    fileId: Schema.String,
  }) {}

export class UploadProgressEventDetail
  extends Schema.TaggedClass<UploadProgressEventDetail>()("Progress", {
    fileId: Schema.String,
    partIndex: Schema.Number,
    totalParts: Schema.Number,
    percent: Schema.Number,
  }) {}

export class UploadCompleteEvent
  extends Schema.TaggedClass<UploadCompleteEvent>()("Complete", {
    fileId: Schema.String,
  }) {}

export const UploadProgressEvent = Schema.Union(
  UploadInitEvent,
  UploadProgressEventDetail,
  UploadCompleteEvent,
);

export type UploadProgressEvent = Schema.Schema.Type<
  typeof UploadProgressEvent
>;

/**
 * Uploads a raw File/Blob by orchestrating Init, UploadPart, and CompleteUpload.
 * Yields progress events through an Effect Stream using Schema validation/models.
 * Automatically cleans up via `CancelUpload` if aborted or interrupted.
 */
export const Upload = (
  name: string,
  blob: Blob,
  partSize: number = 524288, // Default to 512KB
): Stream.Stream<UploadProgressEvent, FsError> => {
  return Stream.unwrapScoped(
    Effect.gen(function* () {
      const totalSize = blob.size;

      const isSinglePart = totalSize <= 10 * 1024 * 1024 &&
        totalSize <= partSize;
      const actualPartSize = isSinglePart ? totalSize : partSize;
      const totalParts = isSinglePart
        ? 1
        : Math.ceil(totalSize / actualPartSize);

      const fileId = yield* InitUpload({
        file_size: totalSize,
        part_size: actualPartSize,
        file_total_parts: totalParts,
      });

      yield* Effect.addFinalizer((exit) =>
        Effect.gen(function* () {
          if (exit._tag === "Failure") {
            yield* CancelUpload(fileId).pipe(Effect.ignoreLogged);
          }
        })
      );

      const initEvent = new UploadInitEvent({ fileId });

      const completedPartsRef = yield* Ref.make(0);

      const partsStream = Stream.fromIterable(
        Array.from({ length: totalParts }, (_, i) => i),
      ).pipe(
        Stream.mapEffect(
          (partIndex) =>
            Effect.gen(function* () {
              const start = partIndex * actualPartSize;
              const end = Math.min(start + actualPartSize, totalSize);
              const chunkBlob = blob.slice(start, end);

              yield* UploadPart({
                file_id: fileId,
                file_total_part: totalParts,
                file_part: partIndex,
              }, chunkBlob);

              const completedCount = yield* Ref.updateAndGet(
                completedPartsRef,
                (count) => count + 1,
              );
              const percent = Math.round((completedCount / totalParts) * 100);

              return new UploadProgressEventDetail({
                fileId,
                partIndex,
                totalParts,
                percent,
              });
            }),
          { concurrency: 4, unordered: true },
        ),
      );

      const completeStream = Stream.fromEffect(
        Effect.gen(function* () {
          yield* CompleteUpload(fileId, {
            name,
            mimetype: blob.type || "application/octet-stream",
          });

          return new UploadCompleteEvent({ fileId });
        }),
      );

      return Stream.make(initEvent).pipe(
        Stream.concat(partsStream),
        Stream.concat(completeStream),
      );
    }),
  );
};
