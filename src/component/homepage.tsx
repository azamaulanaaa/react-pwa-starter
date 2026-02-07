import { useEffect } from "react";
import { z } from "zod";
import { AnyFieldApi, useForm } from "@tanstack/react-form";
import { Field } from "@base-ui/react/field";
import { Button } from "@base-ui/react/button";

const greetingSchema = z.object({
  name: z.string(),
});

function FieldInfo({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && !field.state.meta.isValid
        ? field.state.meta.errors.map((err) => (
          <em key={err.message}>{err.message}</em>
        ))
        : null}
      {field.state.meta.isValidating ? "Validating..." : null}
    </>
  );
}

export function Homepage() {
  useEffect(() => {
    document.title = "Home";
  }, []);

  const form = useForm({
    defaultValues: {
      name: "vite",
    },
    validators: {
      onChange: greetingSchema,
    },
    onSubmit: ({ value }) => {
      alert(`hello, ${value.name}!`);
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
            <Field.Label className="p-1">Name</Field.Label>
            <Field.Control
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="border p-1"
            />
            <Field.Error match={!field.state.meta.isValid}>
              <FieldInfo field={field} />
            </Field.Error>
          </Field.Root>
        )}
      />
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit} className="border p-1">
            {isSubmitting ? "..." : "Submit"}
          </Button>
        )}
      />
    </form>
  );
}
