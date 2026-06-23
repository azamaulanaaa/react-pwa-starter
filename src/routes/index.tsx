import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { proxy } from "comlink";

import { FormTask, FormTaskProps } from "@/components/form/task/index.tsx";
import { ListTask, type Task } from "@/components/list/task/index.tsx";
import { useWorker } from "@/components/worker_context.tsx";

function Index() {
  const worker = useWorker();
  const [data, setData] = useState<Task[]>([]);

  useEffect(() => {
    document.title = "Home";

    if (!worker) return;

    let unsubscribeWorkerStream: () => void;
    let isCancelled = false;

    const setupSubscription = async () => {
      unsubscribeWorkerStream = await worker.db.subscribeToTasks(
        proxy((freshData: Task[]) => {
          setData(freshData || []);
        }),
      );

      if (isCancelled) {
        unsubscribeWorkerStream();
      }
    };

    setupSubscription();

    return () => {
      isCancelled = true;
      if (unsubscribeWorkerStream) unsubscribeWorkerStream();
    };
  }, [worker]);

  const handleOnSubmit: FormTaskProps["onSubmit"] = async (value) => {
    await worker?.db.addTask(value.task);
  };

  const handleOnToggleDone = async (id: number, isDone: boolean) => {
    await worker?.db.updateTaskIsDone(id, isDone);
  };

  const handleOnDelete = async (id: number) => {
    await worker?.db.deleteTask(id);
  };

  return (
    <div className="flex flex-col gap-8 m-4">
      <FormTask onSubmit={handleOnSubmit} />
      <ListTask
        data={data}
        onToggleDone={handleOnToggleDone}
        onDelete={handleOnDelete}
      />
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: Index,
});
