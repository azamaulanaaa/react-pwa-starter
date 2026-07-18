import { createFileRoute } from "@tanstack/react-router";

import { FormTask, FormTaskProps } from "@/components/form/task/index.tsx";
import { ListTask } from "@/components/list/task/index.tsx";
import { useWorker } from "@/components/worker_context.tsx";
import { useReadableStreams } from "@/hooks/use-readable-stream.ts";

function Index() {
  const worker = useWorker()!;

  const streams = useReadableStreams(
    (direction: "next" | "prev") => worker.db.task.stream({ direction }),
    ["next"],
  );

  const flatData = streams.values().map((state) => state.data || []).toArray()
    .flat();

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
        data={flatData}
        onToggleDone={handleOnToggleDone}
        onDelete={handleOnDelete}
      />
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: Index,
});
