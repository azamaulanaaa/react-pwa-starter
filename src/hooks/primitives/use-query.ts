import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  QueryClient,
  type QueryKey,
  QueryObserver,
  type QueryObserverOptions,
  type QueryObserverResult,
} from "@tanstack/query-core";

export const defaultQueryClient = new QueryClient();

export function useQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryFnData,
    TQueryKey
  >,
  client: QueryClient = defaultQueryClient,
): QueryObserverResult<TData, TError> {
  const [observer] = useState(
    () =>
      new QueryObserver<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>(
        client,
        options,
      ),
  );

  useEffect(() => {
    observer.setOptions(options);
  }, [observer, options]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubscribe = observer.subscribe(onStoreChange);
      return unsubscribe;
    },
    [observer],
  );

  const getSnapshot = useCallback(
    () => observer.getCurrentResult(),
    [observer],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
