import type { Story, StoryDefault } from "@ladle/react";
import { FormSetting, FormSettingProps, FormSettingValue } from "./index.tsx";

export default {
  title: "Form / Setting",
} as StoryDefault;

export const Base: Story<FormSettingProps> = (props) => {
  const handleSubmit = (value: FormSettingValue) => {
    alert(JSON.stringify(value));
  };

  return <FormSetting {...props} onSubmit={handleSubmit} />;
};
