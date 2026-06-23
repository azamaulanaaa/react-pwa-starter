import { createContext, ReactNode, useContext } from "react";

import "@/lib/worker.ts";
export type WorkerType = typeof import("@/worker/main.ts");

export type SyncRemoteProxy<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Ret
    ? (...args: Args) => Promise<Awaited<Ret>>
    : T[K] extends object ? SyncRemoteProxy<T[K]>
    : Promise<T[K]>;
};

const WorkerContext = createContext<null | SyncRemoteProxy<WorkerType>>(null);

const worker = new ComlinkWorker(
  new URL("../worker/main.ts", import.meta.url),
  { type: "module" },
) as unknown as SyncRemoteProxy<WorkerType>;

export const WorkerProvider = ({ children }: { children: ReactNode }) => {
  return (
    <WorkerContext.Provider value={worker}>
      {children}
    </WorkerContext.Provider>
  );
};

export const useWorker = () => {
  const context = useContext(WorkerContext);

  return context;
};
