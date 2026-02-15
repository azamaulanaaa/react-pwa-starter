import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const AppStateSchema = z.object({
  language: z.enum(["en"]),
});

type AppState = {
  value: z.infer<typeof AppStateSchema>;
  setValue: (updates: Partial<z.input<typeof AppStateSchema>>) => void;
};

export const useAppState = create<AppState>()(
  persist(
    (set, _get) => ({
      value: {
        language: "en",
      },
      setValue: (updates) =>
        set((state) => ({
          value: AppStateSchema.parse({ ...state.value, ...updates }),
        })),
    }),
    {
      name: "app-state",
    },
  ),
);
