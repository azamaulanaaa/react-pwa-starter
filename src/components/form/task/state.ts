import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Schema } from "effect";

import { useTranslation } from "@/components/i18n_context.tsx";

export const useFormTaskSchema = () => {
  const { t } = useTranslation("ui");

  return Schema.standardSchemaV1(Schema.Struct({
    task: Schema.String.pipe(
      Schema.minLength(1, { message: () => t("form_task_error_task_empty") }),
    ),
  }));
};

export type formTaskState = {
  value: Schema.Schema.Type<ReturnType<typeof useFormTaskSchema>>;
  setValue: (
    value: Schema.Schema.Type<ReturnType<typeof useFormTaskSchema>>,
  ) => void;
};

export const useFormTaskState = create<formTaskState>()(
  persist(
    (set, _get) => ({
      value: {
        task: "",
      },
      setValue: (value) => set({ value: value }),
    }),
    {
      name: "form-task",
    },
  ),
);
