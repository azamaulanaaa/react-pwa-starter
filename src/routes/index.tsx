import { useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { FormTask, FormTaskValue } from "@/components/form/task/index.tsx";
import { ListTask } from "@/components/list/task/index.tsx";
import { useWorker } from "@/components/worker_context.tsx";
import { useReadableStreams } from "@/hooks/use-readable-stream.ts";
import { usePersistState } from "@/hooks/use-persist-state.ts";
import { useDebouncedCallback } from "@/hooks/use-debounce.ts";

function Index() {
  const worker = useWorker()!;
  const [state, setState] = usePersistState<{ form_task?: FormTaskValue }>(
    "task",
    {},
  );
  const setDebouncedState = useDebouncedCallback(setState, 500);

  const streamFactory = useRef(
    () => worker.db.task.stream({ direction: "next" }),
  );
  const streamParams = useRef([null]);
  const streams = useReadableStreams(
    streamFactory.current,
    streamParams.current,
  );

  const flatData = useMemo(
    () =>
      streams.values().map((state) => state.data || []).toArray()
        .flat(),
    [streams],
  );

  const handleOnSubmit = async (value: FormTaskValue) => {
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
      <FormTask
        defaultValues={state.form_task}
        onChange={(value) => setDebouncedState({ form_task: value })}
        onSubmit={handleOnSubmit}
      />
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
