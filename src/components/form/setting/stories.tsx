import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  FormSetting,
  type FormSettingProps,
  type FormSettingValue,
} from "@/components/form/setting/index.tsx";

const meta: Meta<FormSettingProps> = {
  title: "Form / Setting",
  args: {
    onSubmit: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  render: (args) => {
    const handleSubmit = (value: FormSettingValue) => {
      alert(JSON.stringify(value));
    };

    return <FormSetting {...args} onSubmit={handleSubmit} />;
  },
};
