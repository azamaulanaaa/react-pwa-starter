import { create } from "zustand";
import { persist } from "zustand/middleware";

import { z } from "zod";

export const formTaskSchema = z.object({
  task: z.string().min(1),
});

type formGreetingState = {
  value: z.input<typeof formTaskSchema>;
  setValue: (value: z.input<typeof formTaskSchema>) => void;
};

export const useFormTaskState = create<formGreetingState>()(
  persist(
    (set, _get) => ({
      value: {
        task: "",
      },
      setValue: (value: z.input<typeof formTaskSchema>) =>
        set({ value: value }),
    }),
    {
      name: "form-task",
    },
  ),
);
