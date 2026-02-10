import { RemoteObject } from "comlink";
import { createContext, ReactNode, useContext } from "react";

export type WorkerType = typeof import("@/worker/main.ts");

const WorkerContext = createContext<null | RemoteObject<WorkerType>>(null);

const worker = new ComlinkWorker<WorkerType>(
  new URL("../worker/main.ts", import.meta.url),
  { type: "module" },
);

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
