import { Dexie, type EntityTable } from "dexie";

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
