import { useCallback, useEffect, useEffectEvent, useRef } from "react";

export type UseElementVisibilityOptions = {
  rootNode: HTMLElement | null;
  onVisibilityChange?: (tag: string, isVisible: boolean) => void;
  marginPx?: number;
};

export function useElementVisibility({
  rootNode,
  onVisibilityChange,
  marginPx = 50,
}: UseElementVisibilityOptions) {
  const registryRef = useRef<Map<Element, string>>(new Map());
  const trackedNodesRef = useRef<Map<string, Element>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleVisibilityChange = useEffectEvent(
    (tag: string, isVisible: boolean) => {
      onVisibilityChange?.(tag, isVisible);
    },
  );

  useEffect(() => {
    if (!rootNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const tag = registryRef.current.get(entry.target);
          if (tag) {
            handleVisibilityChange(tag, entry.isIntersecting);
          }
        });
      },
      {
        root: rootNode,
        threshold: 0,
        rootMargin: `${marginPx}px 0px ${marginPx}px 0px`,
      },
    );

    observerRef.current = observer;

    registryRef.current.forEach((_, element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [rootNode, marginPx]);

  const watchElement = useCallback((element: Element, tag: string) => {
    registryRef.current.set(element, tag);
    trackedNodesRef.current.set(tag, element);
    observerRef.current?.observe(element);
  }, []);

  const unwatchElement = useCallback((element: Element) => {
    observerRef.current?.unobserve(element);
    const tag = registryRef.current.get(element);
    if (tag) {
      trackedNodesRef.current.delete(tag);
    }
    registryRef.current.delete(element);
  }, []);

  const trackRef = useCallback(
    (tag: string) => (element: Element | null) => {
      if (element) {
        const existingNode = trackedNodesRef.current.get(tag);
        if (existingNode === element) return;
        if (existingNode) unwatchElement(existingNode);

        watchElement(element, tag);
      } else {
        const existingNode = trackedNodesRef.current.get(tag);
        if (existingNode) {
          unwatchElement(existingNode);
        }
      }
    },
    [watchElement, unwatchElement],
  );

  return { trackRef };
}
