// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/components/context/translation.tsx";
import {
  TableGeneric,
  type TableGenericProps,
} from "@/components/table/generic/index.tsx";

type Person = {
  id: string;
  name: string;
  status: string;
};

const PEOPLE: Person[] = [
  { id: "a", name: "Ada", status: "active" },
  { id: "b", name: "Linus", status: "idle" },
];

const COLUMNS: ColumnDef<Person>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

const DICTIONARY = {
  table_generic_select_row: "Select row {{id}}",
  table_generic_select_all_row: "Select all rows",
  table_generic_empty: "No rows",
};

function renderTable(
  props: Partial<TableGenericProps<Person>> = {},
) {
  const onRowSelectionChange = vi.fn();

  render(
    <TranslationProvider dictionary={DICTIONARY}>
      <TableGeneric
        columns={COLUMNS}
        data={PEOPLE}
        getRowId={(row) => `person-${row.id}`}
        onRowSelectionChange={onRowSelectionChange}
        {...props}
      />
    </TranslationProvider>,
  );

  return { onRowSelectionChange };
}

function SelectionHarness({
  onChange,
}: {
  onChange?: (state: RowSelectionState) => void;
}) {
  const [selection, setSelection] = useState<RowSelectionState>({});

  const handleChange: TableGenericProps<Person>["onRowSelectionChange"] = (
    updater,
  ) => {
    setSelection((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      onChange?.(next);
      return next;
    });
  };

  return (
    <TranslationProvider dictionary={DICTIONARY}>
      <TableGeneric
        columns={COLUMNS}
        data={PEOPLE}
        getRowId={(row) => `person-${row.id}`}
        onRowSelectionChange={handleChange}
        rowSelection={selection}
      />
    </TranslationProvider>
  );
}

describe("TableGeneric", () => {
  it("renders the columns and the rows", () => {
    renderTable();

    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("Ada")).toBeDefined();
    expect(screen.getByText("Linus")).toBeDefined();
  });

  it("reports selection by the getRowId value", () => {
    const onChange = vi.fn();
    render(<SelectionHarness onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Select row person-a"));

    expect(onChange).toHaveBeenCalledWith({ "person-a": true });
  });

  it("marks the row selected from the controlled state", () => {
    render(
      <TranslationProvider dictionary={DICTIONARY}>
        <TableGeneric
          columns={COLUMNS}
          data={PEOPLE}
          getRowId={(row) => `person-${row.id}`}
          onRowSelectionChange={() => {}}
          rowSelection={{ "person-a": true }}
        />
      </TranslationProvider>,
    );

    const row = screen.getByText("Ada").closest("tr");
    expect(row?.getAttribute("data-state")).toBe("selected");
  });

  it("selects every row from the header checkbox", () => {
    render(<SelectionHarness />);

    fireEvent.click(screen.getByLabelText("Select all rows"));

    const rows = screen.getAllByText(/Ada|Linus/).map((cell) =>
      cell.closest("tr")
    );
    for (const row of rows) {
      expect(row?.getAttribute("data-state")).toBe("selected");
    }
  });

  it("hides a column from the controlled visibility state", () => {
    renderTable({ columnVisibility: { status: false } });

    expect(screen.queryByText("Status")).toBeNull();
    expect(screen.getByText("Name")).toBeDefined();
  });

  it("renders the empty state", () => {
    renderTable({ data: [] });

    expect(screen.getByText("No rows")).toBeDefined();
  });
});
