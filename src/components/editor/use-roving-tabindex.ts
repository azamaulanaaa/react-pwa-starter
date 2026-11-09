import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

/** Selects the focusable controls that join the roving tab order. */
const ITEM_SELECTOR = "[data-toolbar-item]";

/** Defines the props that one toolbar control needs for the roving tab order. */
export interface RovingItemProps {
  "data-toolbar-item": "";
  tabIndex: number;
}

/** Defines the roving tabindex state and handlers for one toolbar. */
export interface RovingTabindex {
  containerRef: RefObject<HTMLDivElement | null>;
  getItemProps: (index: number) => RovingItemProps;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/** Returns true when one toolbar control cannot receive focus. */
function isDisabled(element: HTMLElement): boolean {
  return (
    (element as HTMLButtonElement).disabled === true ||
    element.getAttribute("aria-disabled") === "true"
  );
}

/**
 * Gives a toolbar one tab stop and moves focus with the arrow keys.
 * ArrowLeft and ArrowRight move to the previous and next control. Home and End
 * move to the first and last control. The hook cancels each handled key press,
 * so the editor selection does not move.
 */
export function useRovingTabindex(): RovingTabindex {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const getItems = useCallback((): HTMLElement[] => {
    if (containerRef.current === null) return [];

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
    );
  }, []);

  useEffect(() => {
    const items = getItems();
    const active = items[activeIndex];

    if (active !== undefined && !isDisabled(active)) return;

    const nextIndex = items.findIndex((item) => !isDisabled(item));

    if (nextIndex !== -1 && nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  });

  const getItemProps = useCallback(
    (index: number): RovingItemProps => ({
      "data-toolbar-item": "",
      tabIndex: index === activeIndex ? 0 : -1,
    }),
    [activeIndex],
  );

  const onFocus = useCallback(
    (event: FocusEvent<HTMLElement>): void => {
      const target = event.target as HTMLElement;
      const item = target.closest<HTMLElement>(ITEM_SELECTOR);

      if (item === null || containerRef.current?.contains(item) !== true) {
        return;
      }

      const index = getItems().indexOf(item);

      if (index !== -1) setActiveIndex(index);
    },
    [getItems],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }

      const items = getItems().filter((item) => !isDisabled(item));

      if (items.length === 0) return;

      const current = items.indexOf(event.target as HTMLElement);
      let next: HTMLElement;

      if (event.key === "Home") {
        next = items[0];
      } else if (event.key === "End") {
        next = items[items.length - 1];
      } else if (event.key === "ArrowRight") {
        next = items[(current + 1) % items.length];
      } else {
        next = items[(current - 1 + items.length) % items.length];
      }

      event.preventDefault();
      next.focus();

      const index = getItems().indexOf(next);

      if (index !== -1) setActiveIndex(index);
    },
    [getItems],
  );

  return { containerRef, getItemProps, onFocus, onKeyDown };
}
