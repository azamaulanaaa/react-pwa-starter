import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App, router } from "@/app.tsx";
import { isEnabledAtBuildTime } from "@/telemetry/config.ts";
import "@/app.css";

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("New content available. Reload to update?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App is ready to work offline!");
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Start OpenTelemetry after the first paint. The code imports the SDK
// dynamically, so the SDK is in its own lazy chunk. The SDK never blocks the
// first page load. The build-time flag controls the import here, not inside
// the SDK. A disabled build does not download the chunk.
if (isEnabledAtBuildTime()) {
  void import("@/telemetry/index.ts")
    .then((telemetry) => telemetry.setupTelemetry({ router }))
    .catch(() => {
      // Telemetry must never break the app.
    });
}
