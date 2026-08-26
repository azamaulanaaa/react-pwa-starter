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

// Initialize OpenTelemetry after first paint. The SDK is dynamically imported
// so it ships in its own lazy chunk and never blocks initial page load.
// Gating on the build-time flag here (not inside the SDK) means a disabled
// build never even downloads the chunk.
if (isEnabledAtBuildTime()) {
  void import("@/telemetry/index.ts")
    .then((telemetry) => telemetry.setupTelemetry({ router }))
    .catch(() => {
      // Telemetry must never break the app.
    });
}
