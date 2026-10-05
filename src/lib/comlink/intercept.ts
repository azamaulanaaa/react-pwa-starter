/**
 * Intercept every method call on a Comlink remote proxy.
 *
 * A Comlink remote has no enumerable shape. Each property access returns a new
 * callable function proxy. Comlink sends the RPC only from the apply trap of
 * that proxy.
 *
 * The interceptor uses the same shape. The function creates one callable proxy
 * for each node. The proxy delegates `get`, `apply`, `set` and `construct` to
 * the wrapped node. It sends each apply to the `intercept` callback of the
 * caller, together with the accumulated dotted path, such as "db.task.get".
 *
 * The proxy passes `then` and symbol keys through unchanged, so `await proxy.x`
 * keeps the Comlink behavior for a value read. `releaseProxy`, `createEndpoint`
 * and the iterator protocols also keep that behavior.
 *
 * SET and CONSTRUCT RPCs are delegated but not intercepted. Only calls are
 * observable.
 *
 * The function also works on plain nested objects with function leaves, so a
 * test can call it without a worker.
 */

export type ProxyCallInterceptor = (
  /**
   * The dotted method path, such as "db.task.get".
   * The path is "" for a call on the root.
   */
  path: string,
  args: readonly unknown[],
  /** Invoke the underlying call. The call always returns a promise. */
  next: () => Promise<unknown>,
) => Promise<unknown>;

export function interceptProxy<T extends object>(
  proxy: T,
  intercept: ProxyCallInterceptor,
): T {
  const interceptNode = (
    node: unknown,
    path: string,
  ): object => {
    // The cache stores one entry per key. Repeated accesses then return the
    // same proxy identity. This matters for consumers that store
    // `proxy.db.task.get` in a variable.
    const cache = new Map<string, unknown>();

    return new Proxy(() => {}, {
      get(_target, key, receiver) {
        if (typeof key !== "string" || key === "then") {
          return Reflect.get(node as object, key, receiver);
        }
        let wrapped = cache.get(key);
        if (wrapped === undefined) {
          wrapped = interceptNode(
            Reflect.get(node as object, key, receiver),
            path ? `${path}.${key}` : key,
          );
          cache.set(key, wrapped);
        }
        return wrapped;
      },

      apply(_target, thisArg, args) {
        return intercept(path, args, () =>
          Promise.resolve(
            Reflect.apply(
              node as (...callArgs: unknown[]) => unknown,
              thisArg,
              args,
            ),
          ));
      },

      set(_target, key, value) {
        // The trap delegates the write. Comlink still sends the SET RPC to the
        // remote node. The trap does not intercept the write.
        return Reflect.set(node as object, key, value);
      },

      construct(_target, args, newTarget) {
        // The trap delegates `new proxy.X(...)`. Comlink sends the CONSTRUCT
        // RPC. The trap does not intercept the call.
        return Reflect.construct(
          node as new (
            ...callArgs: unknown[]
          ) => unknown,
          args,
          newTarget as NewableFunction,
        ) as object;
      },
    });
  };

  return interceptNode(proxy, "") as T;
}
