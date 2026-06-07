import type { Story, StoryDefault } from "@ladle/react";

import { TextInput, TextInputProps } from "./index.tsx";

export default {
  title: "Base / Text Input",
} as StoryDefault;

export const Base: Story<TextInputProps> = (props) => <TextInput {...props} />;
Base.args = {
  placeholder: "Basic Input",
};

export const Disabled: Story<TextInputProps> = (props) => (
  <TextInput {...props} />
);
Disabled.args = {
  value: "Disabled Input",
  disabled: true,
};
