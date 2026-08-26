import { createContext, ReactNode, useContext } from "react";

import "@/lib/comlink/index.ts";
import { type SyncRemoteProxy, wrap } from "@/lib/comlink/index.ts";
export type WorkerType = typeof import("@/worker/main.ts");

const forceDedicated = typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("worker") === "dedicated";

export const workerMode: "shared" | "dedicated" =
  forceDedicated || typeof SharedWorker === "undefined"
    ? "dedicated"
    : "shared";

const WorkerContext = createContext<null | SyncRemoteProxy<WorkerType>>(null);

const createWorker = (): SyncRemoteProxy<WorkerType> => {
  if (workerMode === "shared") {
    const shared = new SharedWorker(
      new URL("../../worker/main.ts", import.meta.url),
      { type: "module", name: `${__APP_NAME__}-main` },
    );

    return wrap(shared.port) as unknown as SyncRemoteProxy<WorkerType>;
  }

  return wrap(
    new Worker(new URL("../../worker/main.ts", import.meta.url), {
      type: "module",
    }),
  ) as unknown as SyncRemoteProxy<WorkerType>;
};

const worker = createWorker();

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
