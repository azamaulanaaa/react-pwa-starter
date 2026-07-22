import { AnyFieldApi, useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import { useTranslation } from "@/components/i18n_context.tsx";
import { Form } from "src/components/ui/form.tsx";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";

import { useFormTaskSchema, useFormTaskState } from "./state.ts";
import { Input } from "src/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";

function FieldInfo({ field }: { field: AnyFieldApi }) {
  const { t } = useTranslation("ui");

  return (
    <>
      {field.state.meta.isTouched && !field.state.meta.isValid
        ? field.state.meta.errors.map((err) => (
          <em key={err.message}>{err.message}</em>
        ))
        : null}
      {field.state.meta.isValidating ? t("validating") : null}
    </>
  );
}

export type FormTaskProps = {
  onSubmit: (
    value: Schema.Schema.Type<ReturnType<typeof useFormTaskSchema>>,
  ) => void | Promise<void>;
};

export function FormTask(props: FormTaskProps) {
  const { t } = useTranslation("ui");

  const formTaskSchema = useFormTaskSchema();
  const [value, setValue] = useFormTaskState();

  const form = useForm({
    defaultValues: value,
    validators: {
      onChange: Schema.standardSchemaV1(formTaskSchema),
    },
    onSubmit: async ({ value, formApi }) => {
      await props.onSubmit(value);

      const resetValue = { task: "" };
      formApi.reset(resetValue);
      setValue(resetValue);
    },
    listeners: {
      onChange: ({ formApi }) => {
        setValue(formApi.state.values);
      },
    },
  });

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex w-full flex-row gap-4 place-items-center"
    >
      <form.Field
        name="task"
        children={(field) => (
          <Field className="w-full">
            <FieldLabel>{t("form_task_description_label")}</FieldLabel>
            <Input
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t("form_task_description_placeholder")}
            />
            <FieldError match={!field.state.meta.isValid}>
              <FieldInfo field={field} />
            </FieldError>
          </Field>
        )}
      />
      <Button type="submit">
        {t("form_task_insert")}
      </Button>
    </Form>
  );
}
