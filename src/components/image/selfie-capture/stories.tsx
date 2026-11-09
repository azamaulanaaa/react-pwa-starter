import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  SelfieCapture,
  type SelfieCaptureProps,
} from "@/components/image/selfie-capture/index.tsx";

const meta = {
  title: "Image / Selfie Capture",
  component: SelfieCapture,
} satisfies Meta<SelfieCaptureProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  args: {
    locateOnMount: false,
  },
  render: (args) => <SelfieCapture {...args} />,
};

export const NoCamera: Story = {
  args: {
    locateOnMount: false,
  },
  render: (args) => <SelfieCapture cameraAvailable={false} {...args} />,
};

export const Disabled: Story = {
  args: {
    locateOnMount: false,
  },
  render: (args) => (
    <SelfieCapture cameraAvailable={false} disabled {...args} />
  ),
};
