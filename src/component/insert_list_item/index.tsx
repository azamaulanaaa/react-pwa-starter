import { z } from "zod";
import { AnyFieldApi, useForm } from "@tanstack/react-form";
import { Field } from "@base-ui/react/field";
import { Button } from "@base-ui/react/button";

import { useTranslation } from "@/component/i18n_context.tsx";
import { insertListItemSchema, useInsertListItemState } from "./state.ts";

function FieldInfo({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && !field.state.meta.isValid
        ? field.state.meta.errors.map((err) => (
          <em key={err.message}>{err.message}</em>
        ))
        : null}
    </>
  );
}

export type FormInsertListItemProps = {
  onSubmit: (
    value: z.infer<typeof insertListItemSchema>,
  ) => void | Promise<void>;
};

export function FormInsertListItem(props: FormInsertListItemProps) {
  const { t } = useTranslation("ui");

  const value = useInsertListItemState((s) => s.value);
  const setValue = useInsertListItemState((s) => s.setValue);

  const form = useForm({
    defaultValues: value,
    validators: {
      onChange: insertListItemSchema,
    },
    onSubmit: async ({ value }) => {
      const zValue = insertListItemSchema.parse(value);
      await props.onSubmit(zValue);
    },
    listeners: {
      onChange: ({ formApi }) => {
        setValue(formApi.state.values);
      },
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-2"
    >
      <form.Field
        name="content"
        children={(field) => (
          <Field.Root className="flex flex-col gap-1">
            <Field.Label className="p-1">{t("content_label")}</Field.Label>
            <Field.Control
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t("content_placeholder")}
              className="border rounded p-1"
            />
            <Field.Error match={!field.state.meta.isValid}>
              <FieldInfo field={field} />
            </Field.Error>
          </Field.Root>
        )}
      />
      <Button type="submit" className="border rounded p-1">
        {t("submit_button")}
      </Button>
    </form>
  );
}
