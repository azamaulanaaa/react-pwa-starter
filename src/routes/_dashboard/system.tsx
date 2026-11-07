import { createFileRoute } from "@tanstack/react-router";

import { SystemPage } from "@/components/system/system-page.tsx";

export const Route = createFileRoute("/_dashboard/system")({
  component: SystemPage,
  staticData: {
    breadcrumb: "System",
  },
});
