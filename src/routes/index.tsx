import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FormTask, FormTaskProps } from "@/components/form/task/index.tsx";
import { ListTask, type Task } from "@/components/list/task/index.tsx";
import { useWorker } from "@/components/worker_context.tsx";

function Index() {
  const worker = useWorker();
  const [data, setData] = useState<Task[]>([]);

  useEffect(() => {
    document.title = "Home";
    fetchData();
  }, []);

  const fetchData = () => {
    worker?.db.listTasks().then((data) => setData(data ? data : []));
  };

  const handleOnSubmit: FormTaskProps["onSubmit"] = async (value) => {
    await worker?.db.addTask(value.task);
    fetchData();
  };

  const handleOnToggleDone = async (id: number, isDone: boolean) => {
    await worker?.db.updateTaskIsDone(id, isDone);
    fetchData();
  };

  const handleOnDelete = async (id: number) => {
    await worker?.db.deleteTask(id);
    fetchData();
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
