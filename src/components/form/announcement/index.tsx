import { useId, useMemo, useRef } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { Schema } from "effect";

import { useTranslation } from "@/components/context/translation.tsx";
import { useOptionalWorker } from "@/components/context/worker.tsx";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/editor/index.ts";
import { recordEditorEvent } from "@/components/editor/editor-telemetry.ts";
import {
  createWorkerImageUpload,
  type ImageUploadHandler,
} from "@/components/editor/image-upload.ts";
import { FieldInfo } from "@/components/form/field-info.tsx";
import {
  type FormAnnouncementValue,
  useFormAnnouncementSchema,
} from "@/components/form/announcement/schema.ts";
import { Button } from "@/components/ui/button.tsx";
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
import {
  createLocalMentionSource,
  LOCAL_MENTION_TARGETS,
} from "@/lib/mentions/index.ts";
import { canonicalize, validate } from "@/lib/markdown/index.ts";

export type { FormAnnouncementValue } from "@/components/form/announcement/schema.ts";

const LOCAL_MENTION_SOURCE = createLocalMentionSource(LOCAL_MENTION_TARGETS);

export const FormAnnouncementDefaultValue: FormAnnouncementValue = {
  title: "",
  body: "",
  variant: "info",
  preferredPresentation: "banner",
};

export type FormAnnouncementProps = {
  defaultValues?: FormAnnouncementValue;
  onChange?: (value: FormAnnouncementValue) => void;
  onSubmit: (value: FormAnnouncementValue) => void | Promise<void>;
  /** Uploads one image. The form uses the worker store when this is unset. */
  onUploadImage?: ImageUploadHandler;
};

export function FormAnnouncement(props: FormAnnouncementProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const bodyErrorId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<MarkdownEditorHandle>(null);
  const lastInvalidCodeRef = useRef<string | null>(null);
  const variantId = useId();
  const presentationId = useId();
  const worker = useOptionalWorker();
  const workerUpload = useMemo(
    () => (worker === null ? undefined : createWorkerImageUpload(worker)),
    [worker],
  );
  const onUploadImage = props.onUploadImage ?? workerUpload;
  const schema = useFormAnnouncementSchema(
    t("system_announcements_form_markdown_invalid"),
  );
  const standardSchema = useMemo(
    () =>
      Schema.toStandardSchemaV1(schema, {
        checkHook: (issue) =>
          issue.filter.annotations?.message ??
          t("system_announcements_form_required"),
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

  /**
   * Records one failed Markdown validation.
   * The function keeps one event for each error code.
   */
  function recordInvalidMarkdown(markdown: string): void {
    const validation = validate(markdown);

    if (validation.ok) {
      lastInvalidCodeRef.current = null;
      return;
    }

    if (lastInvalidCodeRef.current === validation.code) return;

    lastInvalidCodeRef.current = validation.code;
    recordEditorEvent("editor.markdown.invalid", {
      code: validation.code,
    });
  }

  const form = useForm({
    defaultValues: props.defaultValues ?? FormAnnouncementDefaultValue,
    validators: {
      onChange: standardSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      await props.onSubmit({
        ...value,
        title: value.title.trim(),
        body: canonicalize(value.body.trim()),
      });
      formApi.reset(FormAnnouncementDefaultValue);
    },
    onSubmitInvalid: ({ formApi }) => {
      recordInvalidMarkdown(formApi.state.values.body);

      const firstInvalid = (["title", "body"] as const).find(
        (name) => (formApi.state.fieldMeta[name]?.errors.length ?? 0) > 0,
      );

      if (firstInvalid === "title") {
        titleRef.current?.focus();
      }

      if (firstInvalid === "body") {
        bodyRef.current?.focus();
      }
    },
    listeners: {
      onChange: ({ formApi }) => {
        props.onChange?.(formApi.state.values);
        recordInvalidMarkdown(formApi.state.values.body);
      },
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  return (
    <Form
      className="flex flex-col gap-4"
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
              ref={titleRef}
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
        {(field) => {
          const showError =
            field.state.meta.isTouched && !field.state.meta.isValid;
          const describedBy =
            showError || field.state.meta.isValidating
              ? bodyErrorId
              : undefined;

          return (
            <Field>
              <FieldLabel htmlFor={bodyId}>
                {t("system_announcements_form_body_label")}
              </FieldLabel>
              <MarkdownEditor
                ariaDescribedBy={describedBy}
                ariaInvalid={showError ? true : undefined}
                ariaLabel={t("system_announcements_form_body_label")}
                id={bodyId}
                mentionSource={LOCAL_MENTION_SOURCE}
                onChange={field.handleChange}
                onUploadImage={onUploadImage}
                placeholder={t("system_announcements_form_body_placeholder")}
                ref={bodyRef}
                value={field.state.value}
                variant="standard"
              />
              <div id={bodyErrorId}>
                <FieldInfo
                  field={field}
                  validatingLabel="system_announcements_form_validating"
                />
              </div>
            </Field>
          );
        }}
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
      <Button loading={isSubmitting} type="submit">
        {t("system_announcements_form_submit")}
      </Button>
    </Form>
  );
}
