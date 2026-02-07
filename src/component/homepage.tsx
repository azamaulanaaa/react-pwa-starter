import { useEffect } from "react";
import { z } from "zod";
import { AnyFieldApi, useForm } from "@tanstack/react-form";

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
          <div className="flex gap-1">
            <label className="p-1">Name</label>
            <input
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="border p-1"
            />
            <FieldInfo field={field} />
          </div>
        )}
      />
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit} className="border p-1">
            {isSubmitting ? "..." : "Submit"}
          </button>
        )}
      />
    </form>
  );
}
