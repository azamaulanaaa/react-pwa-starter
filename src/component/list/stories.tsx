import type { Story, StoryDefault } from "@ladle/react";

import { List, ListProps } from "./index.tsx";

export default {
  title: "list",
} as StoryDefault;

export const Base: Story<ListProps> = (props) => <List {...props} />;
Base.args = {
  items: [
    {
      "id": "id-1",
      "content": "react + vite",
      created_at: new Date("2026-02-13"),
    },
    {
      "id": "id-2",
      "content": "pwa",
      created_at: new Date("2026-02-14"),
    },
  ],
};
