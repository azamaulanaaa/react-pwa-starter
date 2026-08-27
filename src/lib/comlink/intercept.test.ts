import { describe, expect, it } from "vitest";

import { interceptProxy } from "@/lib/comlink/index.ts";

interface Inner {
  get: (id: string) => Promise<{ id: string }>;
  boom: () => Promise<never>;
}

interface Shape {
  db: { task: Inner };
  leaf: (n: number) => Promise<number>;
}

const makeApi = (): Shape => ({
  db: {
    task: {
      get: (id: string) => Promise.resolve({ id }),
      boom: () => Promise.reject(new Error("kaboom")),
    },
  },
  leaf: (n: number) => Promise.resolve(n * 2),
});

describe("interceptProxy", () => {
  it("routes nested applies through the interceptor with dotted paths", async () => {
    const calls: Array<{ path: string; args: unknown[] }> = [];
    const proxy = interceptProxy(makeApi(), (path, args, next) => {
      calls.push({ path, args: [...args] });
      return next();
    });

    await expect(proxy.db.task.get("t1")).resolves.toEqual({ id: "t1" });
    await expect(proxy.leaf(21)).resolves.toBe(42);

    expect(calls).toEqual([
      { path: "db.task.get", args: ["t1"] },
      { path: "leaf", args: [21] },
    ]);
  });

  it("resolves through next() without invoking it unless awaited", async () => {
    const api = makeApi();
    let invoked = false;
    api.leaf = (n) => {
      invoked = true;
      return Promise.resolve(n);
    };

    let release: ((v: unknown) => void) | undefined;
    const gate = new Promise<unknown>((resolve) => (release = resolve));
    const proxy = interceptProxy(
      api,
      (_path, _args, next) => gate.then(() => next()),
    );

    const result = proxy.leaf(1);
    expect(invoked).toBe(false); // underlying call still gated
    (release as (v: unknown) => void)(undefined);
    await expect(result).resolves.toBe(1);
    expect(invoked).toBe(true);
  });

  it("propagates rejections and lets the interceptor see them", async () => {
    let seen: unknown;
    const proxy = interceptProxy(
      makeApi(),
      (_path, _args, next) =>
        next().catch((error) => {
          seen = error;
          throw error;
        }),
    );

    await expect(proxy.db.task.boom()).rejects.toThrow("kaboom");
    expect(seen).toBeInstanceOf(Error);
  });

  it("caches wrapped members so identities stay stable", () => {
    const proxy = interceptProxy(makeApi(), (_p, _a, next) => next());

    expect(proxy.db).toBe(proxy.db);
    expect(proxy.db.task.get).toBe(proxy.db.task.get);
  });

  it("passes `then` and symbol keys through untouched", () => {
    const symbol = Symbol("k");
    const api = { ...makeApi(), [symbol]: "sym-value" };
    const proxy = interceptProxy(api, (_p, _a, next) => next()) as Record<
      PropertyKey,
      unknown
    >;

    expect(proxy.then).toBeUndefined();
    expect(proxy[symbol]).toBe("sym-value");
  });

  it("delegates SET to the wrapped node without intercepting", () => {
    const api = makeApi();
    const calls: string[] = [];
    const proxy = interceptProxy(api, (path, _args, next) => {
      calls.push(path);
      return next();
    });

    (proxy.db.task as unknown as Record<string, unknown>).label = "x";

    expect((api.db.task as unknown as Record<string, unknown>).label).toBe("x");
    expect(calls).toEqual([]); // writes are visible on the node, never spanned
  });
});
