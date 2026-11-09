export type AnnouncementVariant = "info" | "success" | "warning" | "error";

export type AnnouncementPresentation = "dialog" | "banner";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  variant: AnnouncementVariant;
  preferredPresentation: AnnouncementPresentation;
}

export type AnnouncementInput = Omit<Announcement, "id">;

export interface AnnouncementDelivery {
  activeId: string | null;
  presentation: AnnouncementPresentation | null;
  snoozedUntil: Record<string, number>;
  dismissed: string[];
}

export type AnnouncementStatus = "idle" | "visible" | "snoozed" | "dismissed";
