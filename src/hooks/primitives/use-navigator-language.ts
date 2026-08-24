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
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("languagechange", onStoreChange);

  return () => {
    window.removeEventListener("languagechange", onStoreChange);
  };
}

export function useNavigatorLanguage() {
  return useSyncExternalStore(
    subscribeToLanguageChange,
    getLangSnapshot,
    getServerSnapshot,
  );
}
