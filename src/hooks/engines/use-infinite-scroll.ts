import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useReadableStreams } from "@/hooks/primitives/use-readable-stream.ts";
import {
  ScrollPosition,
  useScrollWatcher,
} from "@/hooks/primitives/use-scroll-watcher.ts";
import { useElementVisibility } from "@/hooks/primitives/use-element-visibility.ts";
import { useDebounce } from "@/hooks/primitives/use-debounce.ts";

export type BaseParams = {
  direction: "next" | "prev";
  limit?: number;
  startCursor?: string;
  endCursor?: string;
};

type UseInfiniteScrollOptions = {
  initialLimit?: number;
};

const areParamsEqual = (
  a: BaseParams | null,
  b: BaseParams | null,
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.direction === b.direction &&
    a.limit === b.limit &&
    a.startCursor === b.startCursor &&
    a.endCursor === b.endCursor
  );
};

export function useInfiniteScroll<T extends { id: string }>(
  factory: (params: BaseParams) => Promise<ReadableStream<T[]>>,
  options: UseInfiniteScrollOptions = {},
) {
  const { initialLimit = 100 } = options;

  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);
  const [optimizedParams, setOptimizedParams] = useState<BaseParams>({
    limit: initialLimit,
    direction: "next",
  });
  const [scrollParams, setScrollParams] = useState<BaseParams | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());

  const params = useMemo(
    () =>
      [optimizedParams, scrollParams].filter(
        (p): p is BaseParams => p !== null,
      ),
    [optimizedParams, scrollParams],
  );

  const findStreamStates = useReadableStreams(factory, params);

  const data = useMemo(() => {
    const uniqueItems = new Map<string, T>();

    for (const state of findStreamStates.values()) {
      if (!state.data) continue;
      for (const item of state.data) {
        uniqueItems.set(item.id, item);
      }
    }

    return Array.from(uniqueItems.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  }, [findStreamStates]);

  const dataRef = useRef(data);
  dataRef.current = data;

  const sortedVisibleItems = useMemo(
    () => data.filter((item) => item && visibleIds.has(item.id)),
    [data, visibleIds],
  );

  const debouncedVisibleItems = useDebounce(sortedVisibleItems, 1_000);

  useEffect(() => {
    const firstId = debouncedVisibleItems.at(0)?.id;
    const lastId = debouncedVisibleItems.at(-1)?.id;

    const newParams: BaseParams = debouncedVisibleItems.length === 0
      ? { limit: initialLimit, direction: "next" }
      : { direction: "next", startCursor: firstId, endCursor: lastId };

    setOptimizedParams((prev) =>
      areParamsEqual(prev, newParams) ? prev : newParams
    );
  }, [debouncedVisibleItems, initialLimit]);

  const handleOnScrollPositionChange = useCallback(
    (position: ScrollPosition) => {
      const currentData = dataRef.current;
      if (currentData.length === 0) return;

      let newParams: BaseParams;

      switch (position) {
        case ScrollPosition.Top:
          newParams = {
            limit: initialLimit,
            direction: "prev",
            startCursor: currentData.at(0)?.id,
          };
          break;
        case ScrollPosition.Unscrollable:
          newParams = { limit: initialLimit, direction: "next" };
          break;
        case ScrollPosition.Bottom:
          newParams = {
            limit: initialLimit,
            direction: "next",
            startCursor: currentData.at(-1)?.id,
          };
          break;
        default:
          return;
      }

      setScrollParams((prev) =>
        areParamsEqual(prev, newParams) ? prev : newParams
      );
    },
    [initialLimit],
  );

  const { viewportRef: scrollWatcherRef, adjustScrollAnchor } =
    useScrollWatcher({
      onPositionChange: handleOnScrollPositionChange,
    });

  const prevTopIdRef = useRef<string | undefined>(undefined);
  const prevCountRef = useRef<number>(0);

  useLayoutEffect(() => {
    const currentTopId = data.at(0)?.id;
    const currentCount = data.length;

    const hasPrependedItems = prevCountRef.current > 0 &&
      currentCount > prevCountRef.current &&
      currentTopId !== prevTopIdRef.current;

    if (hasPrependedItems) {
      adjustScrollAnchor();
    }

    prevTopIdRef.current = currentTopId;
    prevCountRef.current = currentCount;
  }, [data, adjustScrollAnchor]);

  const handleOnVisibilityChange = useCallback(
    (id: string, isVisible: boolean) => {
      setVisibleIds((prev) => {
        if (isVisible === prev.has(id)) return prev;
        const next = new Set(prev);
        if (isVisible) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    },
    [],
  );

  const { trackRef } = useElementVisibility({
    rootNode: viewportNode,
    onVisibilityChange: handleOnVisibilityChange,
  });

  const viewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollWatcherRef(node);
      setViewportNode(node);
    },
    [scrollWatcherRef],
  );

  return {
    data,
    viewportRef,
    trackRef,
  };
}
