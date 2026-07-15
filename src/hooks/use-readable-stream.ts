import { useEffect, useRef, useState } from "react";

export interface StreamState<T> {
  data: T;
  error: Error | null;
  loading: boolean;
}

export function useReadableStreams<T, P>(
  streamFactory: (param: P) => Promise<ReadableStream<T>>,
  params: P[],
  initialValues?: (P extends PropertyKey ? Record<P, T> : never) | Map<P, T>,
): Map<P, StreamState<T | undefined>> {
  const getInitialValue = (key: P): T | undefined => {
    if (!initialValues) return undefined;
    if (initialValues instanceof Map) {
      return initialValues.get(key);
    }
    return (initialValues as any)[key as any];
  };

  const [statesMap, setStatesMap] = useState<
    Map<P, StreamState<T | undefined>>
  >(() => {
    const initialMap = new Map<P, StreamState<T | undefined>>();
    params.forEach((param) => {
      initialMap.set(param, {
        data: getInitialValue(param),
        error: null,
        loading: true,
      });
    });
    return initialMap;
  });

  const activeStreamsRef = useRef<
    Map<P, { reader: ReadableStreamDefaultReader<T>; isCancelled: boolean }>
  >(new Map());

  useEffect(() => {
    const currentParamsSet = new Set(params);
    const activeStreams = activeStreamsRef.current;

    for (const [param, active] of activeStreams.entries()) {
      if (!currentParamsSet.has(param)) {
        active.isCancelled = true;
        active.reader.cancel().catch((err) =>
          console.error(`Error details for cancelling stream:`, err)
        );
        activeStreams.delete(param);

        setStatesMap((prev) => {
          const next = new Map(prev);
          next.delete(param);
          return next;
        });
      }
    }

    params.forEach((param) => {
      if (activeStreams.has(param)) return;

      setStatesMap((prev) => {
        if (prev.has(param)) return prev;
        const next = new Map(prev);
        next.set(param, {
          data: getInitialValue(param),
          error: null,
          loading: true,
        });
        return next;
      });

      const cancellationToken = { isCancelled: false };

      (async () => {
        try {
          const stream = await streamFactory(param);
          if (cancellationToken.isCancelled) return;

          const reader = stream.getReader();
          activeStreams.set(param, {
            reader,
            get isCancelled() {
              return cancellationToken.isCancelled;
            },
            set isCancelled(val) {
              cancellationToken.isCancelled = val;
            },
          });

          while (true) {
            const { value, done } = await reader.read();
            if (done || cancellationToken.isCancelled) break;

            if (value !== undefined) {
              setStatesMap((prev) => {
                const next = new Map(prev);
                next.set(param, { data: value, error: null, loading: false });
                return next;
              });
            }
          }

          if (!cancellationToken.isCancelled) {
            setStatesMap((prev) => {
              const next = new Map(prev);
              const current = next.get(param);
              if (current) next.set(param, { ...current, loading: false });
              return next;
            });
          }
        } catch (err) {
          if (!cancellationToken.isCancelled) {
            const errorInstance = err instanceof Error
              ? err
              : new Error(String(err));
            setStatesMap((prev) => {
              const next = new Map(prev);
              const current = next.get(param);
              next.set(param, {
                data: current?.data,
                error: errorInstance,
                loading: false,
              });
              return next;
            });
          }
        }
      })();
    });
  }, [streamFactory, params]);

  return statesMap;
}
