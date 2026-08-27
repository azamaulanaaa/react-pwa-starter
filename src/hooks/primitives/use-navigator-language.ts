import { useSyncExternalStore } from "react";

function getLangSnapshot(): string {
  if (typeof navigator !== "undefined") {
    return navigator.language || "en";
  }
  return "en";
}

function getServerSnapshot(): string {
  return "en";
}

function subscribeToLanguageChange(onStoreChange: () => void) {
  if (
    typeof globalThis === "undefined" ||
    typeof globalThis.addEventListener !== "function"
  ) {
    return () => {};
  }

  globalThis.addEventListener("languagechange", onStoreChange);

  return () => {
    globalThis.removeEventListener("languagechange", onStoreChange);
  };
}

export function useNavigatorLanguage() {
  return useSyncExternalStore(
    subscribeToLanguageChange,
    getLangSnapshot,
    getServerSnapshot,
  );
}
