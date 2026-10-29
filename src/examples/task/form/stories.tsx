import type { Story, StoryDefault } from "@ladle/react";

import { FormTask, FormTaskProps } from "./index.tsx";

export default {
  title: "Form / Task",
} as StoryDefault;

export const Base: Story<FormTaskProps> = (props) => <FormTask {...props} />;
Base.args = {
  onSubmit: (value) => alert(`New Task: ${value.task}`),
};
