import type { ReplicaReader, ReplicaTransport } from "@/lib/sync/types.ts";

/**
 * Creates a backend-neutral replica reader.
 * The caller gives the transport.
 * A test can give a fake transport.
 */
export function createReplicaReader(
  transport: ReplicaTransport,
): ReplicaReader {
  return {
    status(options) {
      return transport.status(options);
    },
    advance(options) {
      return transport.advance(options);
    },
    manifest(options) {
      return transport.manifest(options);
    },
    async readObject(key, options = {}) {
      if (key.trim() === "") {
        throw new Error("The read failed. The object key is empty.");
      }

      if (options.etag === "") {
        throw new Error("The read failed. The ETag is empty.");
      }

      const result = await transport.readObject(key, options);

      if (result.kind === "not-modified") {
        const etag = result.etag ?? options.etag;

        if (etag === undefined) {
          throw new Error(
            "The read failed. The not-modified result has no ETag.",
          );
        }

        return { kind: "not-modified", etag };
      }

      if (result.object.etag === "") {
        throw new Error("The read failed. The object has no ETag.");
      }

      return result;
    },
  };
}
