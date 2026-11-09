import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ListTask, type ListTaskProps } from "@/examples/task/list/index.tsx";

const meta: Meta<ListTaskProps> = {
  title: "List / Task",
  args: {
    data: [],
    onDelete: () => {},
    onToggleDone: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  args: {
    data: [
      {
        id: "1",
        is_done: false,
        description: "Task #1",
      },
      {
        id: "2",
        is_done: true,
        description: "Task #2",
      },
    ],
  },
  render: (args) => {
    const [data, setData] = useState(args.data);

    const handleOnToggleDone = (id: string, is_done: boolean) => {
      setData((data) =>
        data.map((item) => (item.id == id ? { ...item, is_done } : item)),
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
  },
};
