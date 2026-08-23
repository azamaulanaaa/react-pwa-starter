import { Chunk, Effect, Option, Stream } from "effect";
import { normalizeKey } from "unstorage";
import { FsError } from "@/worker/fs/error.ts";
import { openStore } from "@/worker/fs/store.ts";

export type FileData = string | Uint8Array;

type FsContext = {
  notify: () => void;
  subscribe: (listener: () => void) => () => void;
};

function createChangeBus() {
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    notify() {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

const normalizePath = (path: string) =>
  path
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part.length > 0 && part !== ".")
    .join("/");

function parsePath(path: string): Effect.Effect<string, FsError> {
  const cleaned = normalizePath(path);

  if (cleaned.split("/").includes("..")) {
    return Effect.fail(
      new FsError({ error: `Path traversal is not allowed: '${path}'` }),
    );
  }

  const normalized = normalizeKey(cleaned);

  if (normalized.length === 0) {
    return Effect.fail(
      new FsError({ error: `Invalid file path '${path}'` }),
    );
  }

  return Effect.succeed(normalized);
}

function parseDir(dir: string): Effect.Effect<string, FsError> {
  const cleaned = normalizePath(dir);

  if (cleaned.split("/").includes("..")) {
    return Effect.fail(
      new FsError({ error: `Path traversal is not allowed: '${dir}'` }),
    );
  }

  return Effect.succeed(normalizeKey(cleaned));
}

function generateFsApi(ctx: FsContext) {
  const open = Effect.tryPromise({
    try: () => openStore(),
    catch: (error) => new FsError({ error }),
  });

  function listEntries(
    dir: string,
  ): Effect.Effect<string[], FsError> {
    return Effect.gen(function* () {
      const storage = yield* open;
      const base = dir.length > 0 ? `${dir}:` : "";

      const keys = yield* Effect.tryPromise({
        try: () => storage.getKeys(base),
        catch: (error) => new FsError({ error }),
      });

      const names = new Set<string>();
      for (const key of keys) {
        const rest = key.slice(base.length);
        if (rest.length === 0) continue;
        const separator = rest.indexOf(":");
        names.add(separator === -1 ? rest : rest.slice(0, separator));
      }

      return [...names].sort();
    });
  }

  return {
    exists: (path: string) =>
      Effect.gen(function* () {
        const key = yield* parsePath(path);
        const storage = yield* open;

        return yield* Effect.tryPromise({
          try: () => storage.has(key),
          catch: (error) => new FsError({ error }),
        });
      }),
    readFile: (path: string) =>
      Effect.gen(function* () {
        const key = yield* parsePath(path);
        const storage = yield* open;

        const value = yield* Effect.tryPromise({
          try: () => storage.getItem(key),
          catch: (error) => new FsError({ error }),
        });

        if (typeof value === "string" || value instanceof Uint8Array) {
          return value;
        }

        const raw = yield* Effect.tryPromise({
          try: () => storage.getItemRaw(key),
          catch: (error) => new FsError({ error }),
        });

        if (raw == null) {
          return yield* Effect.fail(
            new FsError({ error: `File '${path}' not found` }),
          );
        }

        return raw satisfies Uint8Array as FileData;
      }),
    writeFile: (path: string, data: FileData) =>
      Effect.gen(function* () {
        const key = yield* parsePath(path);
        const storage = yield* open;

        yield* Effect.tryPromise({
          try: () =>
            typeof data === "string"
              ? storage.setItem(key, data)
              : storage.setItemRaw(key, data),
          catch: (error) => new FsError({ error }),
        });

        ctx.notify();
      }),
    deleteFile: (path: string) =>
      Effect.gen(function* () {
        const key = yield* parsePath(path);
        const storage = yield* open;

        const existed = yield* Effect.tryPromise({
          try: () => storage.has(key),
          catch: (error) => new FsError({ error }),
        });

        if (!existed) {
          return false;
        }

        yield* Effect.tryPromise({
          try: () => storage.remove(key),
          catch: (error) => new FsError({ error }),
        });

        ctx.notify();

        return true;
      }),
    listDir: (dir: string) =>
      Effect.gen(function* () {
        const vDir = yield* parseDir(dir);
        return yield* listEntries(vDir);
      }),
    removeDir: (dir: string) =>
      Effect.gen(function* () {
        const vDir = yield* parseDir(dir);
        const storage = yield* open;

        const base = vDir.length > 0 ? `${vDir}:` : "";
        const keys = yield* Effect.tryPromise({
          try: () => storage.getKeys(base),
          catch: (error) => new FsError({ error }),
        });

        let removed = 0;
        for (const key of keys) {
          yield* Effect.tryPromise({
            try: () => storage.remove(key),
            catch: (error) => new FsError({ error }),
          });
          removed++;
        }

        ctx.notify();

        return removed;
      }),
    stream: (dir: string) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const vDir = yield* parseDir(dir);

          return Stream.async<string[], FsError>((emit) => {
            let stopped = false;

            const push = () =>
              Effect.runPromise(listEntries(vDir)).then((result) => {
                if (!stopped) emit(Effect.succeed(Chunk.of(result)));
              }, (error) => {
                if (!stopped) {
                  emit(Effect.fail(Option.some(new FsError({ error }))));
                }
              });

            push();

            const unsubscribe = ctx.subscribe(() => {
              if (!stopped) push();
            });

            return Effect.sync(() => {
              stopped = true;
              unsubscribe();
            });
          });
        }),
      ),
  };
}

export type Fs = ReturnType<typeof generateFsApi>;

export function createFileSystem(): Fs {
  const bus = createChangeBus();
  const ctx: FsContext = {
    notify: bus.notify,
    subscribe: bus.subscribe,
  };

  return generateFsApi(ctx);
}

export const fs = createFileSystem();
