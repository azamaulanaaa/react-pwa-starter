import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FormTask, FormTaskProps } from "@/components/form/task/index.tsx";
import { ListTask, type Task } from "@/components/list/task/index.tsx";

function Index() {
  const [data, setData] = useState<Task[]>([]);

  useEffect(() => {
    document.title = "Home";
  }, []);

  const handleOnSubmit: FormTaskProps["onSubmit"] = (value) => {
    setData((data) => [...data, {
      id: data.length.toString(),
      description: value.task,
      isDone: false,
    }]);
  };

  const handleOnToggleDone = (id: string, isDone: boolean) => {
    setData((data) =>
      data.map((item) => item.id == id ? { ...item, isDone } : item)
    );
  };

  const handleOnDelete = (id: string) => {
    setData((data) => data.filter((item) => item.id != id));
  };

  return (
    <div className="flex flex-col gap-8">
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
