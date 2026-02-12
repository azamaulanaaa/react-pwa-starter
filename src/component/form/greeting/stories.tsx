import type { Story } from "@ladle/react";

import { Greeting, GreetingProps } from "./index.tsx";

export const Base: Story<GreetingProps> = (props) => <Greeting {...props} />;
Base.args = {
  onSubmit: (value) => alert(`Hello, ${value.name}!`),
};
