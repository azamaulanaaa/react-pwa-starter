import { Schema } from "effect";

/** Defines one KiB in bytes. */
export const KIB = 1024;

/** Defines the largest part size for a multipart upload. */
export const MAX_UPLOAD_PART_SIZE = 512 * KIB;

/** Defines the largest file size for a single-part upload. */
export const MAX_SINGLE_PART_SIZE = 10 * 1024 * KIB;

/** Identifies one upload or one file. The value is opaque. */
export const FileIdSchema = Schema.NonEmptyString;
export type FileId = Schema.Schema.Type<typeof FileIdSchema>;

/** Describes one stored file. */
export const FileMetadataSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  mimetype: Schema.NonEmptyString,
});
export type FileMetadata = Schema.Schema.Type<typeof FileMetadataSchema>;

// A non-negative integer. v4 has no `Schema.NonNegativeInt`.
const NonNegativeInt = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
);

/**
 * Defines the declaration for one upload.
 * The caller gives the file size, the part size, and the part count.
 */
export const UploadInitSchema = Schema.Struct({
  file_size: NonNegativeInt,
  part_size: NonNegativeInt,
  file_total_parts: NonNegativeInt,
}).pipe(
  Schema.check(
    Schema.makeFilter((data) => {
      if (data.file_size === 0) {
        return "The upload failed. The file size is zero.";
      }
      if (data.part_size === 0) {
        return "The upload failed. The part size is zero.";
      }
      if (data.file_total_parts === 0) {
        return "The upload failed. The part count is zero.";
      }

      if (data.file_total_parts === 1) {
        if (data.part_size !== data.file_size) {
          return "The upload failed. For one part, the part size must equal the file size.";
        }
        if (data.file_size > MAX_SINGLE_PART_SIZE) {
          return "The upload failed. A single part must not be larger than 10 MiB.";
        }

        return;
      }

      const isMultipleOf1KiB = data.part_size % KIB === 0;
      const withinBounds = data.part_size <= MAX_UPLOAD_PART_SIZE;

      if (!isMultipleOf1KiB || !withinBounds) {
        return "The upload failed. The part size must be a multiple of 1 KiB and at most 512 KiB.";
      }

      const expectedParts = Math.ceil(data.file_size / data.part_size);
      if (data.file_total_parts !== expectedParts) {
        return `The upload failed. The part count must be ${expectedParts} for this file size and part size.`;
      }

      return;
    }),
  ),
);
export type UploadInit = Schema.Schema.Type<typeof UploadInitSchema>;

/** Defines the reference to one part of an upload. */
export const UploadPartRefSchema = Schema.Struct({
  file_id: FileIdSchema,
  file_total_part: NonNegativeInt,
  file_part: NonNegativeInt,
});
export type UploadPartRef = Schema.Schema.Type<typeof UploadPartRefSchema>;

// These names keep the worker imports stable after the move.
export const MetadataUploadSchema = UploadInitSchema;
export type MetadataUpload = UploadInit;
export const MetadataUploadPartSchema = UploadPartRefSchema;
export type MetadataUploadPart = UploadPartRef;
