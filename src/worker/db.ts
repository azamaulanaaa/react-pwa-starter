import { Dexie, type EntityTable, liveQuery } from "dexie";
import { Observable } from "rxjs";

export type Task = {
  id: number;
  description: string;
  isDone: boolean;
};

const db = new Dexie("main") as Dexie & {
  tasks: EntityTable<Task, "id">;
};

db.version(1).stores({
  tasks: "++id, description, isDone",
});

export async function addTask(description: string) {
  let id = await db.tasks.add({
    description,
    isDone: false,
  });

  return await db.tasks.get(id)!;
}

export async function deleteTask(id: number) {
  await db.tasks.delete(id);
}

export async function listTasks() {
  return await db.tasks.toArray();
}

export async function updateTaskIsDone(id: number, isDone: boolean) {
  await db.tasks.update(id, { isDone });
}

export function subscribeToTasks(callback: (tasks: Task[]) => void) {
  const tasksObservable$ = new Observable<Task[]>((subscriber) => {
    const observable = liveQuery(() => db.tasks.toArray());

    const subscription = observable.subscribe({
      next: (val) => subscriber.next(val),
      error: (err) => subscriber.error(err),
    });

    return () => subscription.unsubscribe();
  });

  const sub = tasksObservable$.subscribe({
    next: (data) => callback(data),
  });

  return () => sub.unsubscribe();
}
