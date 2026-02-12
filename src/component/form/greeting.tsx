import { z } from "zod";
import { AnyFieldApi, useForm } from "@tanstack/react-form";
import { Field } from "@base-ui/react/field";
import { Button } from "@base-ui/react/button";

import { useTranslation } from "@/component/i18n_context.tsx";

import {
  formGreetingSchema,
  useFormGreetingState,
} from "@/component/form/greeting.state.ts";

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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-row gap-2"
    >
      <form.Field
        name="name"
        children={(field) => (
          <Field.Root className="flex gap-1">
            <Field.Label className="p-1">{t("name_label")}</Field.Label>
            <Field.Control
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t("name_placeholder")}
              className="border p-1"
            />
            <Field.Error match={!field.state.meta.isValid}>
              <FieldInfo field={field} />
            </Field.Error>
          </Field.Root>
        )}
      />
      <Button type="submit" className="border p-1">
        {t("submit_button")}
      </Button>
    </form>
  );
}
