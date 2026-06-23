import type { Story, StoryDefault } from "@ladle/react";
import { useState } from "react";

import { ListTask, ListTaskProps } from "./index.tsx";

export default {
  title: "List / Task",
} as StoryDefault;

export const Base: Story<ListTaskProps> = (props) => {
  const [data, setData] = useState(props.data);

  const handleOnToggleDone = (id: string, isDone: boolean) => {
    setData((data) =>
      data.map((item) => item.id == id ? { ...item, isDone } : item)
    );
  };

  const handleOnDelete = (id: string) => {
    setData((data) => data.filter((item) => item.id != id));
  };

  return (
    <ListTask
      data={data}
      onToggleDone={handleOnToggleDone}
      onDelete={handleOnDelete}
    />
  );
};
Base.args = {
  data: [
    {
      id: "1",
      isDone: false,
      description: "Task #1",
    },
    {
      id: "2",
      isDone: true,
      description: "Task #2",
    },
  ],
};
