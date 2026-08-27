import { useEffect, useState } from "react";

export function useSystemDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(
    () =>
      typeof globalThis !== "undefined" &&
      typeof globalThis.matchMedia === "function" &&
      globalThis.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    if (
      typeof globalThis === "undefined" ||
      typeof globalThis.matchMedia !== "function"
    ) {
      return;
    }
    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDarkMode;
}
