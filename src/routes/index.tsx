import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FormTask, FormTaskProps } from "@/components/form/task/index.tsx";
import { ListTask, type Task } from "@/components/list/task/index.tsx";
import { useWorker } from "@/components/worker_context.tsx";

function Index() {
  const worker = useWorker()!;
  const [data, setData] = useState<Task[]>([]);

  useEffect(() => {
    let reader: ReadableStreamDefaultReader<Task[]> | null = null;
    let isCancelled = false;

    (async () => {
      const webStream = await worker!.db.task.stream({
        direction: "next",
      });

      if (isCancelled) {
        webStream.cancel();
        return;
      }

      reader = webStream.getReader();

      try {
        while (!isCancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) setData(value);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error reading task stream:", error);
        }
      } finally {
        if (reader) reader.releaseLock();
      }
    })();

    return () => {
      isCancelled = true;
      if (reader) {
        reader.cancel();
      }
    };
  }, [worker]);

  const handleOnSubmit: FormTaskProps["onSubmit"] = async (value) => {
    await worker.db.task.insertOne({ description: value.task, is_done: false });
  };

  const handleOnToggleDone = async (id: string, is_done: boolean) => {
    await worker.db.task.updateById(id, {
      is_done,
    });
  };

  const handleOnDelete = async (id: string) => {
    await worker.db.task.deleteById(id);
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
