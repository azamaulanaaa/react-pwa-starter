import { describe, expect, it, vi } from "vitest";

import { createRustApiClient } from "@/integrations/rust-api/client.ts";
import { createRustApiFileTransport } from "@/integrations/rust-api/fs.ts";

/** Builds a JSON response for a fake fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("rust-api file transport", () => {
  it("maps the upload lifecycle to the fs routes", async () => {
    const fakeFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.endsWith("/fs/uploads") && method === "POST") {
          return jsonResponse({ file_id: "upload-1" }, 201);
        }

        if (url.endsWith("/fs/uploads/upload-1/parts/0") && method === "PUT") {
          expect(init?.body).toBeInstanceOf(Blob);
          expect(new Headers(init?.headers).get("Content-Type")).toBe(
            "application/octet-stream",
          );

          return new Response(null, { status: 204 });
        }

        if (url.endsWith("/fs/uploads/upload-1/complete")) {
          return jsonResponse({ file_id: "upload-1" });
        }

        if (url.endsWith("/fs/uploads/upload-1") && method === "GET") {
          return jsonResponse({
            file_id: "upload-1",
            file_size: 4,
            part_size: 4,
            total_parts: 1,
            uploaded_parts: [0],
            percent: 100,
          });
        }

        if (url.endsWith("/fs/uploads/upload-1") && method === "DELETE") {
          return new Response(null, { status: 204 });
        }

        if (url.endsWith("/fs/files/upload-1/meta")) {
          return jsonResponse({
            id: "upload-1",
            name: "note.txt",
            mimetype: "text/plain",
            size: 4,
          });
        }

        if (url.endsWith("/fs/files/upload-1") && method === "DELETE") {
          return new Response(null, { status: 204 });
        }

        throw new Error(`unexpected request: ${method} ${url}`);
      },
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const transport = createRustApiFileTransport({ client });
    const blob = new Blob(["test"], { type: "text/plain" });

    const upload = await transport.init({
      file_size: 4,
      part_size: 4,
      file_total_parts: 1,
    });
    await transport.uploadPart(
      { file_id: upload.id, file_total_part: 1, file_part: 0 },
      blob,
    );
    const record = await transport.complete(upload.id, {
      name: "note.txt",
      mimetype: "text/plain",
    });
    const progress = await transport.progress(upload.id);
    await transport.cancel(upload.id);
    await transport.delete(upload.id);

    expect(upload).toEqual({ id: "upload-1", totalParts: 1 });
    expect(record).toEqual({
      id: "upload-1",
      size: 4,
      metadata: { name: "note.txt", mimetype: "text/plain" },
    });
    expect(progress).toEqual({
      id: "upload-1",
      completedParts: 1,
      totalParts: 1,
      percent: 100,
    });
  });

  it("downloads one byte range", async () => {
    const fakeFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/fs/files/file-1/meta")) {
          return jsonResponse({
            id: "file-1",
            name: "note.txt",
            mimetype: "text/plain",
            size: 10,
          });
        }

        expect(new Headers(init?.headers).get("Range")).toBe("bytes=2-5");

        return new Response(new Uint8Array([99, 100, 101, 102]), {
          status: 206,
          headers: {
            "Content-Type": "text/plain",
            "Content-Range": "bytes 2-5/10",
          },
        });
      },
    );
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const transport = createRustApiFileTransport({ client });

    const result = await transport.download("file-1", { start: 2, end: 5 });

    expect(result.file).toEqual({
      id: "file-1",
      size: 10,
      metadata: { name: "note.txt", mimetype: "text/plain" },
    });
    await expect(result.blob.text()).resolves.toBe("cdef");
  });

  it("returns null when the file metadata is absent", async () => {
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: vi.fn(async () =>
        jsonResponse({ error: "The file is absent." }, 404),
      ),
    });
    const transport = createRustApiFileTransport({ client });

    await expect(transport.metadata("file-404")).resolves.toBeNull();
  });

  it("rejects a range outside the file", async () => {
    const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/meta")) {
        return jsonResponse({
          id: "file-1",
          name: "note.txt",
          mimetype: "text/plain",
          size: 2,
        });
      }

      return new Response(null, { status: 416 });
    });
    const client = createRustApiClient({
      baseUrl: "https://api.test",
      fetch: fakeFetch,
    });
    const transport = createRustApiFileTransport({ client });

    const download = transport.download("file-1", { start: 9 });

    await expect(download).rejects.toMatchObject({
      status: 416,
      message: "The download failed. The range is outside the file.",
    });
  });
});
