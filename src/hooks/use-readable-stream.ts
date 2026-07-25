import { useEffect, useState } from "react";

export interface StreamState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
}

export function useReadableStreams<T, P>(
  streamFactory: (param: P) => Promise<ReadableStream<T>>,
  params: P[],
): Map<P, StreamState<T>> {
  const [statesMap, setStatesMap] = useState<Map<P, StreamState<T>>>(() =>
    new Map()
  );

  useEffect(() => {
    const controllers = new Map<P, AbortController>();

    setStatesMap((prev) => {
      const oldParams = new Set(prev.keys());
      const newParams = new Set(params);

      const removedParams = oldParams.difference(newParams);

      if (removedParams.size == 0) return prev;

      const next = new Map(prev);
      removedParams.forEach((param) => next.delete(param));

      return next;
    });

    params.forEach((param) => {
      const controller = new AbortController();
      controllers.set(param, controller);

      setStatesMap((prev) => {
        const next = new Map(prev);
        const existing = prev.get(param);
        next.set(param, {
          data: existing?.data,
          error: null,
          loading: true,
        });
        return next;
      });

      (async () => {
        try {
          const stream = await streamFactory(param);
          if (controller.signal.aborted) return;

          const reader = stream.getReader();

          controller.signal.addEventListener("abort", () => {
            reader.cancel().catch(() => {});
          });

          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (controller.signal.aborted) break;

            if (value !== undefined) {
              setStatesMap((prev) => {
                const next = new Map(prev);
                next.set(param, { data: value, error: null, loading: false });
                return next;
              });
            }

            if (done) break;
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            const error = err instanceof Error ? err : new Error(String(err));
            setStatesMap((prev) => {
              const next = new Map(prev);
              const current = next.get(param);
              next.set(param, {
                data: current?.data,
                error,
                loading: false,
              });
              return next;
            });
          }
        }
      })();
    });

    return () => {
      controllers.forEach((controller) => controller.abort());
    };
  }, [params, streamFactory]);

  return statesMap;
}
