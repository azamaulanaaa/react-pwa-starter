import { create } from "zustand";
import { persist } from "zustand/middleware";

import { z } from "@/lib/zod.ts";

export const formGreetingSchema = z.object({
  name: z.string().min(1),
});

type formGreetingState = {
  value: z.input<typeof formGreetingSchema>;
  setValue: (value: z.input<typeof formGreetingSchema>) => void;
};

export const useFormGreetingState = create<formGreetingState>()(
  persist(
    (set, _get) => ({
      value: {
        name: "",
      },
      setValue: (value: z.input<typeof formGreetingSchema>) =>
        set({ value: value }),
    }),
    {
      name: "form-greeter",
    },
  ),
);
