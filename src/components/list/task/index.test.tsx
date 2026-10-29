// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/components/context/translation.tsx";
import { ListTask, type Task } from "@/components/list/task/index.tsx";

const TASKS: Task[] = [
  { id: "1", is_done: false, description: "Write tests" },
  { id: "2", is_done: true, description: "Ship the table" },
];

const DICTIONARY = {
  list_task_description: "Description",
  list_task_action: "Action",
};

function renderList(overrides: Partial<Parameters<typeof ListTask>[0]> = {}) {
  const onToggleDone = vi.fn();
  const onDelete = vi.fn();

  render(
    <TranslationProvider dictionary={DICTIONARY}>
      <ListTask
        data={TASKS}
        onDelete={onDelete}
        onToggleDone={onToggleDone}
        {...overrides}
      />
    </TranslationProvider>,
  );

  return { onToggleDone, onDelete };
}

describe("ListTask", () => {
  it("renders one row per task", () => {
    renderList();

    expect(screen.getByText("Write tests")).toBeDefined();
    expect(screen.getByText("Ship the table")).toBeDefined();
    expect(screen.getAllByRole("checkbox")).toHaveLength(TASKS.length);
  });

  it("reports the new done value from the row checkbox", () => {
    const { onToggleDone } = renderList();

    fireEvent.click(screen.getAllByRole("checkbox")[0]);

    expect(onToggleDone).toHaveBeenCalledWith("1", true);
  });

  it("reports the task id from the delete button", () => {
    const { onDelete } = renderList();

    fireEvent.click(screen.getAllByLabelText("delete")[1]);

    expect(onDelete).toHaveBeenCalledWith("2");
  });
});
