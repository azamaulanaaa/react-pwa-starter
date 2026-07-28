import { useSyncExternalStore } from "react";

function getLangSnapshot(): string {
  if (typeof document !== "undefined") {
    return document.documentElement.lang || "en";
  }
  return "en";
}

function getServerSnapshot(): string {
  return "en";
}

function subscribeToHtmlLang(onStoreChange: () => void) {
  if (typeof document === "undefined") {
    return () => {};
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "lang") {
        onStoreChange();
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });

  return () => observer.disconnect();
}

export function useHtmlLang() {
  return useSyncExternalStore(
    subscribeToHtmlLang,
    getLangSnapshot,
    getServerSnapshot,
  );
}
