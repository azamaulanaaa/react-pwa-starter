import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const insertListItemSchema = z.object({
  content: z.string().nonempty().trim(),
});

type InsertListItemState = {
  value: z.input<typeof insertListItemSchema>;
  setValue: (value: z.input<typeof insertListItemSchema>) => void;
};

export const useInsertListItemState = create<InsertListItemState>()(
  persist(
    (set, _get) => ({
      value: {
        content: "",
      },
      setValue: (value: z.input<typeof insertListItemSchema>) =>
        set({ value: value }),
    }),
    {
      name: "form-insert_list_item",
    },
  ),
);
