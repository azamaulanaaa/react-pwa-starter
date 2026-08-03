import { useRef } from "react";
import { AnyFieldApi, useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import { useTranslation } from "@/components/context/translation.tsx";
import { Form } from "@/components/ui/form.tsx";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";

const useFormTaskSchema = () => {
  const { t } = useTranslation();

  return Schema.mutable(Schema.Struct({
    task: Schema.String.pipe(
      Schema.nonEmptyString({ message: () => t("form_task_error_task_empty") }),
    ),
  }));
};

export type FormTaskValue = Schema.Schema.Type<
  ReturnType<typeof useFormTaskSchema>
>;

function FieldInfo({ field }: { field: AnyFieldApi }) {
  const { t } = useTranslation();

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
  defaultValues?: FormTaskValue;
  onChange?: (
    value: FormTaskValue,
  ) => void;
  onSubmit: (
    value: FormTaskValue,
  ) => void | Promise<void>;
};

export function FormTask(props: FormTaskProps) {
  const { t } = useTranslation();

  const defaultValues = useRef(props.defaultValues);
  const formTaskSchema = useFormTaskSchema();

  const form = useForm({
    defaultValues: defaultValues.current,
    validators: {
      onChange: Schema.standardSchemaV1(formTaskSchema),
    },
    onSubmit: async ({ value }) => {
      await props.onSubmit(value);
    },
    listeners: {
      onChange: ({ formApi }) => {
        props.onChange?.(formApi.state.values);
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
      <form.Field name="task">
        {(field) => (
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
      </form.Field>
      <Button type="submit">
        {t("form_task_insert")}
      </Button>
    </Form>
  );
}
