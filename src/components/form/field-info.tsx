import { type AnyFieldApi } from "@tanstack/react-form";

import { useTranslation } from "@/components/context/translation.tsx";
import { FieldDescription, FieldError } from "@/components/ui/field.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

export type FieldInfoProps = {
  field: AnyFieldApi;
  validatingLabel: string;
};

export function FieldInfo({ field, validatingLabel }: FieldInfoProps) {
  const { t } = useTranslation();

  const showErrors = field.state.meta.isTouched && !field.state.meta.isValid;

  return (
    <div className="flex flex-col gap-1">
      {showErrors ? (
        <FieldError match={showErrors}>
          {field.state.meta.errors.map((error, index) => (
            <span className="block" key={`${error.message}-${index}`}>
              {error.message}
            </span>
          ))}
        </FieldError>
      ) : null}
      {field.state.meta.isValidating ? (
        <FieldDescription
          aria-live="polite"
          className="flex items-center gap-1.5"
        >
          <Spinner aria-hidden="true" className="size-3" />
          {t(validatingLabel)}
        </FieldDescription>
      ) : null}
    </div>
  );
}
