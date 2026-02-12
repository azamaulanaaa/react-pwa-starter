import type { Story, StoryDefault } from "@ladle/react";

import { FormInsertListItem, FormInsertListItemProps } from "./index.tsx";

export default {
  title: "insert list item",
} as StoryDefault;

export const Base: Story<FormInsertListItemProps> = (props) => (
  <FormInsertListItem {...props} />
);
Base.args = {
  onSubmit: (value) => alert(JSON.stringify(value, null, 2)),
};
