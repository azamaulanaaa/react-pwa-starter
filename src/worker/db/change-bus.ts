export type ChangeBus = {
  subscribe: (tableName: string, listener: () => void) => () => void;
  notify: (tableName: string) => void;
};

export function createChangeBus(): ChangeBus {
  const listeners = new Map<string, Set<() => void>>();

  return {
    subscribe(tableName, listener) {
      let bucket = listeners.get(tableName);
      if (!bucket) {
        bucket = new Set();
        listeners.set(tableName, bucket);
      }
      bucket.add(listener);

      return () => {
        bucket.delete(listener);
      };
    },
    notify(tableName) {
      for (const listener of listeners.get(tableName) ?? []) {
        listener();
      }
    },
  };
}
