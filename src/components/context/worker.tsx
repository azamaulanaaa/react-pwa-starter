import { createContext, ReactNode, useContext } from "react";

import "@/lib/comlink/index.ts";
import { type SyncRemoteProxy } from "@/lib/comlink/index.ts";
export type WorkerType = typeof import("@/worker/main.ts");

const WorkerContext = createContext<null | SyncRemoteProxy<WorkerType>>(null);

const worker = new ComlinkWorker(
  new URL("../../worker/main.ts", import.meta.url),
  { type: "module" },
) as unknown as SyncRemoteProxy<WorkerType>;

export type WorkerProviderProps = {
  children: ReactNode;
};

export const WorkerProvider = (props: WorkerProviderProps) => {
  return (
    <WorkerContext.Provider value={worker}>
      {props.children}
    </WorkerContext.Provider>
  );
};

export const useWorker = () => {
  const context = useContext(WorkerContext);

  if (!context) {
    throw new Error("useWorker must be used within a WorkerProvider");
  }

  return context;
};
