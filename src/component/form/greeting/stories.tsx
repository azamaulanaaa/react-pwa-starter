import type { Story, StoryDefault } from "@ladle/react";

import { Greeting, GreetingProps } from "./index.tsx";

export default {
  title: "Form / Greeting",
} as StoryDefault;

export const Base: Story<GreetingProps> = (props) => <Greeting {...props} />;
Base.args = {
  onSubmit: (value) => alert(`Hello, ${value.name}!`),
};
