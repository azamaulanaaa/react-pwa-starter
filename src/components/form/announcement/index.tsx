import { useId, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";

import { useTranslation } from "@/components/context/translation.tsx";
import { FieldInfo } from "@/components/form/field-info.tsx";
import {
  type FormAnnouncementValue,
  useFormAnnouncementSchema,
} from "@/components/form/announcement/schema.ts";
import { Field, FieldLabel } from "@/components/ui/field.tsx";
import { Form } from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";

export type { FormAnnouncementValue } from "@/components/form/announcement/schema.ts";

export const FormAnnouncementDefaultValue: FormAnnouncementValue = {
  title: "",
  body: "",
  variant: "info",
  preferredPresentation: "banner",
};

export type FormAnnouncementProps = {
  formId?: string;
  defaultValues?: FormAnnouncementValue;
  onChange?: (value: FormAnnouncementValue) => void;
  onSubmit: (value: FormAnnouncementValue) => void | Promise<void>;
};

export function FormAnnouncement(props: FormAnnouncementProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const variantId = useId();
  const presentationId = useId();
  const schema = useFormAnnouncementSchema();
  const standardSchema = useMemo(
    () =>
      Schema.toStandardSchemaV1(schema, {
        checkHook: () => t("system_announcements_form_required"),
      }),
    [schema, t],
  );

  const variantLabels: Record<FormAnnouncementValue["variant"], string> = {
    info: t("system_announcement_variant_info"),
    success: t("system_announcement_variant_success"),
    warning: t("system_announcement_variant_warning"),
    error: t("system_announcement_variant_error"),
  };
  const presentationLabels: Record<
    FormAnnouncementValue["preferredPresentation"],
    string
  > = {
    dialog: t("system_announcement_presentation_dialog"),
    banner: t("system_announcement_presentation_banner"),
  };

  const form = useForm({
    defaultValues: props.defaultValues ?? FormAnnouncementDefaultValue,
    validators: {
      onChange: standardSchema,
    },
    onSubmit: async ({ value }) => {
      await props.onSubmit({
        ...value,
        title: value.title.trim(),
        body: value.body.trim(),
      });
    },
    listeners: {
      onChange: ({ formApi }) => {
        props.onChange?.(formApi.state.values);
      },
    },
  });

  return (
    <Form
      className="flex flex-col gap-4"
      id={props.formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={titleId}>
              {t("system_announcements_form_title_label")}
            </FieldLabel>
            <Input
              aria-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
                  ? true
                  : undefined
              }
              id={titleId}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t("system_announcements_form_title_placeholder")}
              value={field.state.value}
            />
            <FieldInfo
              field={field}
              validatingLabel="system_announcements_form_validating"
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="body">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={bodyId}>
              {t("system_announcements_form_body_label")}
            </FieldLabel>
            <Textarea
              aria-invalid={
                field.state.meta.isTouched && !field.state.meta.isValid
                  ? true
                  : undefined
              }
              id={bodyId}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder={t("system_announcements_form_body_placeholder")}
              value={field.state.value}
            />
            <FieldInfo
              field={field}
              validatingLabel="system_announcements_form_validating"
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="variant">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={variantId}>
              {t("system_announcements_form_variant_label")}
            </FieldLabel>
            <Select
              items={variantLabels}
              onValueChange={(value) =>
                field.handleChange(value as FormAnnouncementValue["variant"])
              }
              value={field.state.value}
            >
              <SelectTrigger id={variantId} name={field.name}>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(variantLabels).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <FieldInfo
              field={field}
              validatingLabel="system_announcements_form_validating"
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="preferredPresentation">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={presentationId}>
              {t("system_announcements_form_presentation_label")}
            </FieldLabel>
            <Select
              items={presentationLabels}
              onValueChange={(value) =>
                field.handleChange(
                  value as FormAnnouncementValue["preferredPresentation"],
                )
              }
              value={field.state.value}
            >
              <SelectTrigger id={presentationId} name={field.name}>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {Object.entries(presentationLabels).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <FieldInfo
              field={field}
              validatingLabel="system_announcements_form_validating"
            />
          </Field>
        )}
      </form.Field>
    </Form>
  );
}
