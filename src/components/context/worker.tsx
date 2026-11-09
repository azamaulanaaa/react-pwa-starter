import { createContext, type ReactNode, useContext } from "react";

import "@/lib/comlink/index.ts";
import { type SyncRemoteProxy, wrap } from "@/lib/comlink/index.ts";
import { instrumentWorkerProxy } from "@/telemetry/comlink.ts";
export type WorkerType = typeof import("@/worker/main.ts");

const forceDedicated =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("worker") === "dedicated";

export const workerMode: "shared" | "dedicated" =
  forceDedicated || typeof SharedWorker === "undefined"
    ? "dedicated"
    : "shared";

const WorkerContext = createContext<null | SyncRemoteProxy<WorkerType>>(null);

const createWorker = (): SyncRemoteProxy<WorkerType> => {
  const proxy =
    workerMode === "shared"
      ? wrapShared()
      : (wrap(
          new Worker(new URL("../../worker/main.ts", import.meta.url), {
            type: "module",
          }),
        ) as unknown as SyncRemoteProxy<WorkerType>);

  // Every call across the boundary becomes a span.
  // This does nothing until the telemetry starts.
  return instrumentWorkerProxy(proxy);
};

const wrapShared = (): SyncRemoteProxy<WorkerType> => {
  const shared = new SharedWorker(
    new URL("../../worker/main.ts", import.meta.url),
    { type: "module", name: `${__APP_NAME__}-main` },
  );

  return wrap(shared.port) as unknown as SyncRemoteProxy<WorkerType>;
};

let worker: null | SyncRemoteProxy<WorkerType> = null;

/**
 * Returns the shared worker proxy.
 * The function creates the proxy on the first call, so a module import alone
 * does not start a worker.
 */
const getWorker = (): SyncRemoteProxy<WorkerType> => {
  if (worker === null) {
    worker = createWorker();
  }

  return worker;
};

export type WorkerProviderProps = {
  children: ReactNode;
};

export const WorkerProvider = (props: WorkerProviderProps) => {
  return (
    <WorkerContext.Provider value={getWorker()}>
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

/**
 * Returns the worker proxy, or null when no `WorkerProvider` is present.
 * Use this hook when the worker is optional.
 */
export const useOptionalWorker = () => useContext(WorkerContext);
