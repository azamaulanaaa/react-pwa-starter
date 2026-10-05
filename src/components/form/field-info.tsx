import { type AnyFieldApi } from "@tanstack/react-form";

import { useTranslation } from "@/components/context/translation.tsx";

export type FieldInfoProps = {
  field: AnyFieldApi;
  validatingLabel: string;
};

export function FieldInfo({ field, validatingLabel }: FieldInfoProps) {
  const { t } = useTranslation();

  return (
    <>
      {field.state.meta.isTouched && !field.state.meta.isValid
        ? field.state.meta.errors.map((err) => (
          <em key={err.message}>{err.message}</em>
        ))
        : null}
      {field.state.meta.isValidating ? t(validatingLabel) : null}
    </>
  );
}