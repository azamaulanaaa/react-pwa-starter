import { Schema } from "effect";

import { useTranslation } from "@/components/i18n_context.tsx";
import { usePersistState } from "@/hooks/use-persist-state.ts";

export const useFormTaskSchema = () => {
  const { t } = useTranslation("ui");

  return Schema.Struct({
    task: Schema.String.pipe(
      Schema.minLength(1, { message: () => t("form_task_error_task_empty") }),
    ),
  });
};

export const useFormTaskState = () =>
  usePersistState("form-task", { task: "" });
