import type React from "react";

import { useTranslation } from "@/components/context/translation.tsx";
import { Badge, type BadgeProps } from "@/components/ui/badge.tsx";
import type {
  AnnouncementPresentation,
  AnnouncementStatus,
  AnnouncementVariant,
} from "@/components/announcement/types.ts";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export const ANNOUNCEMENT_VARIANT_BADGES: Record<
  AnnouncementVariant,
  BadgeVariant
> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
};

export const ANNOUNCEMENT_PRESENTATION_BADGES: Record<
  AnnouncementPresentation,
  BadgeVariant
> = {
  dialog: "outline",
  banner: "secondary",
};

export const ANNOUNCEMENT_STATUS_BADGES: Record<
  AnnouncementStatus,
  BadgeVariant
> = {
  idle: "secondary",
  visible: "success",
  snoozed: "warning",
  dismissed: "outline",
};

export interface AnnouncementVariantBadgeProps {
  variant: AnnouncementVariant;
}

/** Shows the variant of one announcement. */
export function AnnouncementVariantBadge({
  variant,
}: AnnouncementVariantBadgeProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Badge
      data-slot="announcement-variant-badge"
      variant={ANNOUNCEMENT_VARIANT_BADGES[variant]}
    >
      {t(`system_announcement_variant_${variant}`)}
    </Badge>
  );
}

export interface AnnouncementPresentationBadgeProps {
  presentation: AnnouncementPresentation;
}

/** Shows the suggested presentation of one announcement. */
export function AnnouncementPresentationBadge({
  presentation,
}: AnnouncementPresentationBadgeProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Badge
      data-slot="announcement-presentation-badge"
      variant={ANNOUNCEMENT_PRESENTATION_BADGES[presentation]}
    >
      {t(`system_announcement_presentation_${presentation}`)}
    </Badge>
  );
}

export interface AnnouncementStatusBadgeProps {
  status: AnnouncementStatus;
}

/** Shows the delivery status of one announcement. */
export function AnnouncementStatusBadge({
  status,
}: AnnouncementStatusBadgeProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Badge
      data-slot="announcement-status-badge"
      variant={ANNOUNCEMENT_STATUS_BADGES[status]}
    >
      {t(`system_announcement_status_${status}`)}
    </Badge>
  );
}
