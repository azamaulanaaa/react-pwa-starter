import type { Story, StoryDefault } from "@ladle/react";

import { SelfieCapture, type SelfieCaptureProps } from "./index.tsx";

export default {
  title: "Image / Selfie Capture",
} as StoryDefault;

export const Base: Story<SelfieCaptureProps> = (props) => (
  <SelfieCapture {...props} />
);
Base.args = {
  locateOnMount: false,
};

export const NoCamera: Story<SelfieCaptureProps> = (props) => (
  <SelfieCapture cameraAvailable={false} {...props} />
);
NoCamera.args = {
  locateOnMount: false,
};

export const Disabled: Story<SelfieCaptureProps> = (props) => (
  <SelfieCapture cameraAvailable={false} disabled {...props} />
);
Disabled.args = {
  locateOnMount: false,
};
