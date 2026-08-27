/**
 * Intercept every method call on a Comlink remote proxy.
 *
 * Comlink remotes are opaque: each property access returns a fresh callable
 * function-proxy (there is no enumerable shape) and the RPC only fires in that
 * proxy's apply trap. Interception therefore mirrors the same shape — one
 * callable Proxy per node, delegating get/apply/set/construct to the wrapped
 * node and funneling applies through the caller's `intercept` callback with
 * the accumulated dotted path (e.g. "db.task.get").
 *
 * `then` and symbol keys pass through untouched, so `await proxy.x` value
 * reads (a GET RPC under comlink's hood), `releaseProxy`, `createEndpoint`
 * and iterator protocols keep stock semantics. SET and CONSTRUCT RPCs are
 * delegated but not intercepted — by design, only calls are observable.
 *
 * Also works over plain nested objects with function leaves, which keeps this
 * unit-testable without a worker round-trip.
 */

export type ProxyCallInterceptor = (
  /** Dotted method path, e.g. "db.task.get" ("" for a call on the root). */
  path: string,
  args: readonly unknown[],
  /** Invoke the underlying call; always returns a promise. */
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
    // Cache per key so repeated accesses yield stable identities (important
    // for consumers that stash `proxy.db.task.get` in a variable).
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
        // Delegate so comlink's SET RPC still fires on the remote node; not
        // intercepted.
        return Reflect.set(node as object, key, value);
      },

      construct(_target, args, newTarget) {
        // Delegate `new proxy.X(...)` (comlink CONSTRUCT RPC); not
        // intercepted.
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
