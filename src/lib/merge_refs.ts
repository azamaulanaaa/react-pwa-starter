import type { Ref, RefObject } from "react";

export function mergeRefs<T>(
  ...refs: Array<Ref<T> | undefined | null>
): (value: T | null) => void {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as RefObject<T | null>).current = value;
      }
    });
  };
}
