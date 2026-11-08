import { useEffect, useState } from "react";

export type SheetSide = "left" | "right";

function currentSide(): SheetSide {
  if (typeof document === "undefined") return "right";
  return document.documentElement.dir === "rtl" ? "left" : "right";
}

/** Returns the sheet side for the current document direction. */
export function useSheetSide(): SheetSide {
  const [side, setSide] = useState<SheetSide>(currentSide);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const update = (): void => setSide(currentSide());
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["dir"] });

    return () => observer.disconnect();
  }, []);

  return side;
}
