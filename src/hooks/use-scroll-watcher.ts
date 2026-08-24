import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

export const ScrollPosition = {
  Idle: "IDLE",
  Top: "TOP",
  Bottom: "BOTTOM",
  Unscrollable: "UNSCROLLABLE",
} as const;

export type ScrollPosition =
  (typeof ScrollPosition)[keyof typeof ScrollPosition];

export type UseScrollWatcherOptions = {
  onPositionChange?: (position: ScrollPosition) => void;
  bufferPx?: number;
};

export function useScrollWatcher({
  onPositionChange,
  bufferPx = 50,
}: UseScrollWatcherOptions) {
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);

  const scrollSnapshotRef = useRef<
    {
      scrollHeight: number;
      scrollTop: number;
    } | null
  >(null);

  const handlePositionChange = useEffectEvent((position: ScrollPosition) => {
    onPositionChange?.(position);
  });

  const viewportRef = useCallback((node: HTMLDivElement | null) => {
    setViewportNode(node);
  }, []);

  useEffect(() => {
    if (!viewportNode) return;

    const checkBoundary = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewportNode;

      const isScrollable = scrollHeight > clientHeight;

      if (!isScrollable) {
        handlePositionChange(ScrollPosition.Unscrollable);
        return;
      }

      if (scrollHeight - Math.ceil(scrollTop) - clientHeight <= bufferPx) {
        handlePositionChange(ScrollPosition.Bottom);
      }
    };

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewportNode;

      if (Math.abs(scrollTop) < 1) {
        scrollSnapshotRef.current = { scrollHeight, scrollTop };
        handlePositionChange(ScrollPosition.Top);
        return;
      }

      if (scrollHeight - Math.ceil(scrollTop) - clientHeight <= bufferPx) {
        handlePositionChange(ScrollPosition.Bottom);
        return;
      }

      handlePositionChange(ScrollPosition.Idle);
    };

    checkBoundary();

    viewportNode.addEventListener("scroll", handleScroll, { passive: true });

    const mutationObserver = new MutationObserver(() => {
      checkBoundary();
    });
    mutationObserver.observe(viewportNode, { childList: true, subtree: true });

    const resizeObserver = new ResizeObserver(() => {
      checkBoundary();
    });
    resizeObserver.observe(viewportNode);

    return () => {
      viewportNode.removeEventListener("scroll", handleScroll);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [viewportNode, bufferPx]);

  const adjustScrollAnchor = useCallback(() => {
    if (scrollSnapshotRef.current && viewportNode) {
      const heightDiff = viewportNode.scrollHeight -
        scrollSnapshotRef.current.scrollHeight;
      if (heightDiff !== 0) {
        viewportNode.scrollTop = scrollSnapshotRef.current.scrollTop +
          heightDiff;
      }
    }
    scrollSnapshotRef.current = null;
  }, [viewportNode]);

  return {
    viewportRef,
    adjustScrollAnchor,
  };
}
