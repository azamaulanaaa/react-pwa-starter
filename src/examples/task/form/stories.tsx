import type { Meta, StoryObj } from "@storybook/react-vite";

import { FormTask } from "@/examples/task/form/index.tsx";

const meta = {
  title: "Form / Task",
  component: FormTask,
} satisfies Meta<typeof FormTask>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  args: {
    onSubmit: (value) => alert(`New Task: ${value.task}`),
  },
};
