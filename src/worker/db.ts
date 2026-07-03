import { Dexie, type EntityTable, liveQuery } from "dexie";
import { Data, Effect } from "effect";

export type Task = {
  id: number;
  description: string;
  isDone: boolean;
};

export class DbError extends Data.TaggedError("app/worker/db")<{
  readonly error: unknown;
}> {}

const db = new Dexie("main") as Dexie & {
  tasks: EntityTable<Task, "id">;
};

db.version(1).stores({
  tasks: "++id, description, isDone",
});

export function addTask(description: string): Effect.Effect<Task, DbError> {
  return Effect.tryPromise({
    try: async () => {
      const id = await db.tasks.add({ description, isDone: false });
      const task = await db.tasks.get(id);
      if (!task) throw new Error(`Task with id ${id} not found after creation`);
      return task;
    },
    catch: (error) => new DbError({ error }),
  });
}

export function deleteTask(id: number): Effect.Effect<void, DbError> {
  return Effect.tryPromise({
    try: () => db.tasks.delete(id),
    catch: (error) => new DbError({ error }),
  });
}

export function listTasks(): Effect.Effect<Task[], DbError> {
  return Effect.tryPromise({
    try: () => db.tasks.toArray(),
    catch: (error) => new DbError({ error }),
  });
}

export function updateTaskIsDone(
  id: number,
  isDone: boolean,
): Effect.Effect<void, DbError> {
  return Effect.tryPromise({
    try: () => db.tasks.update(id, { isDone }),
    catch: (error) => new DbError({ error }),
  });
}

export function subscribeToTasks(
  callback: (tasks: Task[]) => void,
) {
  return Effect.sync(() => {
    const observable = liveQuery(() => db.tasks.toArray());

    const subscription = observable.subscribe({
      next: (tasks) => callback(tasks),
      error: (err) => {
        console.error("Dexie liveQuery stream failed:", err);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  });
}
