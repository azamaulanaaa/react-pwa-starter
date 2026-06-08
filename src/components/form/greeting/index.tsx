import { z } from "zod";
import { AnyFieldApi, useForm } from "@tanstack/react-form";

import { useTranslation } from "@/components/i18n_context.tsx";
import { Form } from "src/components/ui/form.tsx";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import { formGreetingSchema, useFormGreetingState } from "./state.ts";
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

export type GreetingProps = {
  onSubmit: (value: z.infer<typeof formGreetingSchema>) => void | Promise<void>;
};

export function Greeting(props: GreetingProps) {
  const { t } = useTranslation("ui");

  const value = useFormGreetingState((s) => s.value);
  const setValue = useFormGreetingState((s) => s.setValue);

  const form = useForm({
    defaultValues: value,
    validators: {
      onChange: formGreetingSchema,
    },
    onSubmit: async ({ value }) => {
      const zValue = formGreetingSchema.parse(value);
      await props.onSubmit(zValue);
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
      className="flex w-full max-w-64 flex-col gap-4"
    >
      <form.Field
        name="name"
        children={(field) => (
          <Field>
            <FieldLabel>{t("name_label")}</FieldLabel>
            <Input
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t("name_placeholder")}
            />
            <FieldError match={!field.state.meta.isValid}>
              <FieldInfo field={field} />
            </FieldError>
          </Field>
        )}
      />
      <Button type="submit">
        {t("submit_button")}
      </Button>
    </Form>
  );
}
