import type { Session } from "@/lib/auth/types.ts";

/** The default name of the session channel. */
export const DEFAULT_SESSION_CHANNEL = "auth.session";

/** Holds the storage key for the fallback channel. */
const SESSION_EVENT_KEY = "auth.session.event";

/** Defines one session event. The session is null after a logout. */
export interface SessionEvent {
  /** The session for the other tabs. The value is null after a logout. */
  session: Session | null;
  /** The version of the event. A newer event has a higher value. */
  epoch: number;
}

/**
 * Defines the channel that sends a session to the other tabs.
 * A browser uses `BroadcastChannel`. The fallback uses a storage event.
 */
export interface SessionChannel {
  /** Sends one event to the other tabs. */
  publish(event: SessionEvent): void;
  /** Calls the listener for each event from another tab. The method returns the unsubscribe function. */
  subscribe(listener: (event: SessionEvent) => void): () => void;
  /** Releases the channel resources. */
  close(): void;
}

/** Reports whether a value has the fields of a session event. */
function isSessionEvent(value: unknown): value is SessionEvent {
  if (
    typeof value !== "object" ||
    value === null ||
    !("epoch" in value) ||
    typeof value.epoch !== "number"
  ) {
    return false;
  }

  if (!("session" in value)) return false;
  if (value.session === null) return true;

  return (
    typeof value.session === "object" &&
    value.session !== null &&
    "user" in value.session &&
    typeof value.session.user === "object" &&
    value.session.user !== null &&
    "id" in value.session.user &&
    typeof value.session.user.id === "string" &&
    "expiresAt" in value.session &&
    typeof value.session.expiresAt === "number"
  );
}

/** Creates a channel that uses the browser `BroadcastChannel` API. */
function createBroadcastChannel(name: string): SessionChannel {
  const channel = new BroadcastChannel(name);
  const listeners = new Set<(event: SessionEvent) => void>();

  const handleMessage = (message: MessageEvent<unknown>) => {
    if (!isSessionEvent(message.data)) return;

    for (const listener of listeners) {
      listener(message.data);
    }
  };

  channel.addEventListener("message", handleMessage);

  const unref = (channel as { unref?: () => void }).unref;
  if (typeof unref === "function") {
    unref.call(channel);
  }

  return {
    publish(event) {
      channel.postMessage(event);
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      channel.removeEventListener("message", handleMessage);
      listeners.clear();
      channel.close();
    },
  };
}

/** Creates a channel that uses a storage event. */
function createStorageChannel(name: string): SessionChannel {
  const listeners = new Set<(event: SessionEvent) => void>();
  const win = typeof window === "undefined" ? null : window;
  const storage = (() => {
    try {
      return win === null ? null : win.localStorage;
    } catch {
      return null;
    }
  })();

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_EVENT_KEY || event.newValue === null) return;

    try {
      const value: unknown = JSON.parse(event.newValue);

      if (!isSessionEvent(value)) return;

      for (const listener of listeners) {
        listener(value);
      }
    } catch {
      // A bad event does not change the session.
    }
  };

  win?.addEventListener("storage", handleStorage);

  return {
    publish(event) {
      if (storage === null) return;

      try {
        storage.setItem(
          SESSION_EVENT_KEY,
          JSON.stringify({ ...event, channel: name }),
        );
      } catch {
        // A full storage area does not stop the session update.
      }
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      win?.removeEventListener("storage", handleStorage);
      listeners.clear();
    },
  };
}

/**
 * Creates the cross-tab session channel.
 * The function uses `BroadcastChannel` when the browser provides it.
 * The function uses a storage event for the other browsers.
 */
export function createSessionChannel(
  name: string = DEFAULT_SESSION_CHANNEL,
): SessionChannel {
  if (typeof BroadcastChannel === "function") {
    try {
      return createBroadcastChannel(name);
    } catch {
      // A blocked broadcast channel uses the storage event.
    }
  }

  return createStorageChannel(name);
}
