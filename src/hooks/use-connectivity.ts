import { useCallback, useEffect, useState } from "react";

/** Defines the network and tab state that the flush policy reads. */
export interface UseConnectivityResult {
  /** The current network state. */
  online: boolean;
  /** The current tab visibility. */
  visible: boolean;
  /** The time of the last successful flush. The value is null before the first flush. */
  lastSyncAt: number | null;
  /** Records one successful flush. */
  markSynced: (at?: number) => void;
}

/** Returns the network state. The function guards a test environment. */
function readOnline(): boolean {
  if (typeof navigator === "undefined") return true;

  return navigator.onLine;
}

/** Returns the tab visibility. The function guards a test environment. */
function readVisible(): boolean {
  if (typeof document === "undefined") return true;

  return document.visibilityState !== "hidden";
}

/**
 * Returns the network state, the tab visibility, and the last sync time.
 * The hook listens for the online, offline, and visibility events.
 * A test environment without the browser events keeps the initial values.
 */
export function useConnectivity(): UseConnectivityResult {
  const [online, setOnline] = useState(readOnline);
  const [visible, setVisible] = useState(readVisible);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const markSynced = useCallback((at: number = Date.now()) => {
    setLastSyncAt(at);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibility = () => setVisible(readVisible());

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return { online, visible, lastSyncAt, markSynced };
}
