import type React from "react";
import { useEffect, useId, useRef, useState } from "react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Field, FieldError, FieldLabel } from "@/components/ui/field.tsx";
import { Form } from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import type {
  AnnouncementInput,
  AnnouncementPresentation,
  AnnouncementVariant,
} from "@/components/announcement/types.ts";

const VARIANTS: AnnouncementVariant[] = ["info", "success", "warning", "error"];
const PRESENTATIONS: AnnouncementPresentation[] = ["dialog", "banner"];

interface FormErrors {
  title?: string;
  body?: string;
}

export interface AnnouncementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: AnnouncementInput) => void;
}

/** Creates a custom announcement and shows it with the chosen presentation. */
export function AnnouncementForm({
  open,
  onOpenChange,
  onCreate,
}: AnnouncementFormProps): React.ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const titleErrorId = useId();
  const bodyId = useId();
  const bodyErrorId = useId();
  const variantId = useId();
  const presentationId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [variant, setVariant] = useState<AnnouncementVariant>("info");
  const [presentation, setPresentation] =
    useState<AnnouncementPresentation>("dialog");
  const [errors, setErrors] = useState<FormErrors>({});
  const variantLabels: Record<AnnouncementVariant, string> = {
    info: t("system_announcement_variant_info"),
    success: t("system_announcement_variant_success"),
    warning: t("system_announcement_variant_warning"),
    error: t("system_announcement_variant_error"),
  };
  const presentationLabels: Record<AnnouncementPresentation, string> = {
    dialog: t("system_announcement_presentation_dialog"),
    banner: t("system_announcement_presentation_banner"),
  };

  useEffect(() => {
    if (open) return;

    setTitle("");
    setBody("");
    setVariant("info");
    setPresentation("dialog");
    setErrors({});
  }, [open]);

  const handleCreate = (): void => {
    const nextTitle = title.trim();
    const nextBody = body.trim();
    const nextErrors: FormErrors = {};

    if (nextTitle === "") {
      nextErrors.title = t("system_announcements_form_title_required");
    }

    if (nextBody === "") {
      nextErrors.body = t("system_announcements_form_body_required");
    }

    setErrors(nextErrors);

    if (nextErrors.title !== undefined) {
      titleRef.current?.focus();
      return;
    }

    if (nextErrors.body !== undefined) {
      bodyRef.current?.focus();
      return;
    }

    onCreate({
      title: nextTitle,
      body: nextBody,
      variant,
      preferredPresentation: presentation,
    });
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup showCloseButton={false}>
        <Form
          className="contents"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("system_announcements_form_title")}</DialogTitle>
            <DialogDescription>
              {t("system_announcements_form_description")}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor={titleId}>
                {t("system_announcements_form_title_label")}
              </FieldLabel>
              <Input
                aria-describedby={errors.title ? titleErrorId : undefined}
                aria-invalid={errors.title ? true : undefined}
                id={titleId}
                onChange={(event) => {
                  setTitle(event.target.value);

                  if (errors.title) {
                    setErrors((state) => ({ ...state, title: undefined }));
                  }
                }}
                placeholder={t("system_announcements_form_title_placeholder")}
                ref={titleRef}
                value={title}
              />
              {errors.title ? (
                <FieldError id={titleErrorId} match>
                  {errors.title}
                </FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={bodyId}>
                {t("system_announcements_form_body_label")}
              </FieldLabel>
              <Textarea
                aria-describedby={errors.body ? bodyErrorId : undefined}
                aria-invalid={errors.body ? true : undefined}
                id={bodyId}
                onChange={(event) => {
                  setBody(event.target.value);

                  if (errors.body) {
                    setErrors((state) => ({ ...state, body: undefined }));
                  }
                }}
                placeholder={t("system_announcements_form_body_placeholder")}
                ref={bodyRef}
                value={body}
              />
              {errors.body ? (
                <FieldError id={bodyErrorId} match>
                  {errors.body}
                </FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={variantId}>
                {t("system_announcements_form_variant_label")}
              </FieldLabel>
              <Select
                items={variantLabels}
                onValueChange={(value) =>
                  setVariant(value as AnnouncementVariant)
                }
                value={variant}
              >
                <SelectTrigger id={variantId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {VARIANTS.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {variantLabels[entry]}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={presentationId}>
                {t("system_announcements_form_presentation_label")}
              </FieldLabel>
              <Select
                items={presentationLabels}
                onValueChange={(value) =>
                  setPresentation(value as AnnouncementPresentation)
                }
                value={presentation}
              >
                <SelectTrigger id={presentationId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {PRESENTATIONS.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {presentationLabels[entry]}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Field>
          </DialogPanel>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              {t("system_announcements_form_cancel")}
            </Button>
            <Button type="submit">
              {t("system_announcements_form_submit")}
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
