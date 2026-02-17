import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const AppStateSchema = z.object({
  language: z.enum(["en"]).default("en"),
  theme: z.enum(["light", "dark"]).default("light"),
});

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

function generateSetters<T extends z.ZodObject<any>>(
  set: (partial: Partial<z.infer<T>>) => void,
  schema: T,
): Setters<z.infer<T>> {
  const setters: any = {};

  for (const key of Object.keys(schema.shape)) {
    const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;

    setters[setterName] = (value: z.infer<T>[keyof z.infer<T>]) => {
      const validValue = z.parse(schema.shape[key], value);

      set({ [key]: validValue } as Partial<z.infer<T>>);
    };
  }

  return setters;
}

type AppStateData = z.infer<typeof AppStateSchema>;
export type AppState = AppStateData & Setters<AppStateData>;

export const useAppState = create<AppState>()(
  persist(
    (set) => ({
      ...AppStateSchema.parse({}),
      ...generateSetters(set, AppStateSchema),
    }),
    {
      name: "app-state",
      merge: (persistedState: unknown, currentState) => {
        const parsed = AppStateSchema.safeParse(persistedState);

        if (parsed.success) {
          return { ...currentState, ...parsed.data };
        }

        console.warn(
          "Persisted state invalid. Falling back to defaults.",
          parsed.error,
        );
        return currentState;
      },
    },
  ),
);
