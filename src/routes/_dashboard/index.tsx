import { useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { v7 as randomUUID } from "uuid";

import { FormTask, FormTaskValue } from "@/components/form/task/index.tsx";
import { ListTask } from "@/components/list/task/index.tsx";
import { useWorker } from "@/components/context/worker.tsx";
import { useReadableStreams } from "@/hooks/primitives/use-readable-stream.ts";
import { usePersistState } from "@/hooks/primitives/use-persist-state.ts";
import { useDebouncedCallback } from "@/hooks/primitives/use-debounce.ts";

function Index() {
  const worker = useWorker()!;
  const [state, setState] = usePersistState<{ form_task?: FormTaskValue }>(
    "task",
    {},
  );
  const setDebouncedState = useDebouncedCallback(setState, 500);

  const streamFactory = useRef(
    () => worker.db.task.watch({ direction: "next" }),
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
    await worker.db.task.set(randomUUID(), {
      description: value.task,
      is_done: false,
    });
  };

  const handleOnToggleDone = async (id: string, is_done: boolean) => {
    const task = await worker.db.task.get(id);
    await worker.db.task.set(id, {
      ...task,
      is_done,
    });
  };

  const handleOnDelete = async (id: string) => {
    await worker.db.task.delete(id);
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

export const Route = createFileRoute("/_dashboard/")({
  component: Index,
});
