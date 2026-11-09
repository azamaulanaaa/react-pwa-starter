import type { Announcement } from "@/components/announcement/types.ts";

/**
 * The seed announcement catalog. An application can replace this list with its
 * own data source.
 */
export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "new-dashboard",
    title: "Welcome to the new dashboard",
    body: "The dashboard has a new layout. Your saved pages are still in the same place.",
    variant: "info",
    preferredPresentation: "dialog",
  },
  {
    id: "maintenance-window",
    title: "Scheduled maintenance on Sunday",
    body: "The service is offline on Sunday from 02:00 to 03:00 UTC. Save your work before the maintenance starts.",
    variant: "warning",
    preferredPresentation: "banner",
  },
  {
    id: "offline-ready",
    title: "Offline mode is ready",
    body: "The app now saves your work offline. The app sends the work when the network returns.",
    variant: "success",
    preferredPresentation: "dialog",
  },
];
