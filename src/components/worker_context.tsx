import { createContext, ReactNode, useContext } from "react";

import "@/lib/comlink/index.ts";
import { type SyncRemoteProxy } from "@/lib/comlink/index.ts";
export type WorkerType = typeof import("@/worker/main.ts");

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
