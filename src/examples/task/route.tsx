import { useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { v7 as randomUUID } from "uuid";

import { FormTask, type FormTaskValue } from "@/examples/task/form/index.tsx";
import { ListTask } from "@/examples/task/list/index.tsx";
import type { TaskTableApi } from "@/examples/task/table.ts";
import { useWorker } from "@/components/context/worker.tsx";
import { useReadableStreams } from "@/hooks/primitives/use-readable-stream.ts";
import { usePersistState } from "@/hooks/primitives/use-persist-state.ts";
import { useDebouncedCallback } from "@/hooks/primitives/use-debounce.ts";
import type { SyncRemoteProxy } from "@/lib/comlink/index.ts";

// The app registers the task table in the worker database.
// This type tells the example which table API the worker exposes.
type TaskWorker = SyncRemoteProxy<{ db: { task: TaskTableApi } }>;

function Index() {
  const worker = useWorker() as unknown as TaskWorker;
  const [state, setState] = usePersistState<{ form_task?: FormTaskValue }>(
    "task",
    {},
  );
  const setDebouncedState = useDebouncedCallback(setState, 500);

  const streamFactory = useRef(() =>
    worker.db.task.watch({ direction: "next" }),
  );
  const streamParams = useRef([null]);
  const streams = useReadableStreams(
    streamFactory.current,
    streamParams.current,
  );

  const flatData = useMemo(
    () =>
      streams
        .values()
        .map((state) => state.data || [])
        .toArray()
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

// Copy this file to src/routes/_dashboard/index.tsx to run the example.
export const Route = createFileRoute("/_dashboard/")({
  component: Index,
});
