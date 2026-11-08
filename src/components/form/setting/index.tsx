import { useEffect, useMemo } from "react";
import { Schema } from "effect";
import { useForm, useStore } from "@tanstack/react-form";

import { useTranslation } from "@/components/context/translation.tsx";
import { Form } from "@/components/ui/form.tsx";
import { Field, FieldLabel } from "@/components/ui/field.tsx";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { FieldInfo } from "@/components/form/field-info.tsx";

export function useFormSettingSchema() {
  return Schema.Struct({
    theme: Schema.Literals(["system", "light", "dark"]),
    locale: Schema.Literals(["", "en-US", "id-ID"]),
  });
}
export type FormSettingValue = Schema.Schema.Type<
  ReturnType<typeof useFormSettingSchema>
>;

export type FormSettingProps = {
  defaultValue?: FormSettingValue;
  value?: FormSettingValue;
  onChange?: (value: FormSettingValue) => void;
  onSubmit: (value: FormSettingValue) => void | Promise<void>;
};

export const FormSettingDefaultValue: FormSettingValue = {
  theme: "system",
  locale: "",
};

function useSelectThemeValues(): Record<FormSettingValue["theme"], string> {
  const { t } = useTranslation();

  return {
    system: t("form_setting_theme_select_label_system"),
    light: t("form_setting_theme_select_label_light"),
    dark: t("form_setting_theme_select_label_dark"),
  };
}

function useSelectLocaleValues(): Record<FormSettingValue["locale"], string> {
  const { t } = useTranslation();

  return {
    "": t("form_setting_locale_select_label_system"),
    "en-US": t("form_setting_locale_select_label_en_us"),
    "id-ID": t("form_setting_locale_select_label_id_id"),
  };
}

export function FormSetting(props: FormSettingProps) {
  const { t } = useTranslation();
  const schema = useFormSettingSchema();
  const standard_schema = useMemo(
    () => Schema.toStandardSchemaV1(schema),
    [schema],
  );

  const select_theme_value = useSelectThemeValues();
  const select_locale_value = useSelectLocaleValues();

  const form = useForm({
    defaultValues: props.value ?? props.defaultValue ?? FormSettingDefaultValue,
    validators: {
      onChange: standard_schema,
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

  useEffect(() => {
    if (props.value) {
      form.reset(props.value);
    }
  }, [props.value, form]);

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Form
      className="flex w-full flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="theme">
        {(field) => (
          <Field className="w-full">
            <FieldLabel>{t("form_setting_theme_label")}</FieldLabel>
            <Select
              items={select_theme_value}
              value={field.state.value}
              onValueChange={(value) =>
                field.handleChange(value as FormSettingValue["theme"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(select_theme_value).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <FieldInfo
              field={field}
              validatingLabel="form_setting_validating"
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="locale">
        {(field) => (
          <Field className="w-full">
            <FieldLabel>{t("form_setting_locale_label")}</FieldLabel>
            <Select
              items={select_locale_value}
              value={field.state.value}
              onValueChange={(value) =>
                field.handleChange(value as FormSettingValue["locale"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(select_locale_value).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <FieldInfo
              field={field}
              validatingLabel="form_setting_validating"
            />
          </Field>
        )}
      </form.Field>
      <Button disabled={isSubmitting} loading={isSubmitting} type="submit">
        {t("form_setting_submit_button")}
      </Button>
    </Form>
  );
}
