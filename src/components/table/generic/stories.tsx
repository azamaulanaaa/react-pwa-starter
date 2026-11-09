import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";

import {
  TableGeneric,
  type TableGenericFeatures,
  type TableGenericProps,
} from "@/components/table/generic/index.tsx";
import { Badge } from "@/components/ui/badge.tsx";

const data = [
  { id: 1, name: "John", status: "Online" },
  { id: 2, name: "Sophia", status: "Online" },
  { id: 3, name: "Yusuf", status: "Offline" },
];

type Row = (typeof data)[number];

const columns: ColumnDef<TableGenericFeatures, Row>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => {
      switch (row.getValue("status")) {
        case "Online": {
          return (
            <Badge className="bg-green-200 text-green-900">
              {row.getValue("status")}
            </Badge>
          );
        }
        case "Offline": {
          return (
            <Badge className="bg-red-200 text-red-900">
              {row.getValue("status")}
            </Badge>
          );
        }
        default: {
          return (
            <Badge className="bg-neutral-200 text-neutral-900">
              {row.getValue("status")}
            </Badge>
          );
        }
      }
    },
    header: "Status",
  },
];

const meta: Meta<TableGenericProps<Row>> = {
  title: "Table / Generic",
  args: {
    columns,
    data: [],
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  args: {
    columns,
  },
  render: (args) => {
    const [rowSelections, setRowSelections] = useState<RowSelectionState>({});
    const [columnVisibility, setColumnVisibility] = useState({});

    return (
      <TableGeneric
        {...args}
        rowSelection={rowSelections}
        onRowSelectionChange={(state) => setRowSelections(state)}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        data={data}
      />
    );
  },
};

export const Empty: Story = {
  args: { columns, data: [] },
  render: (args) => {
    return <TableGeneric {...args} />;
  },
};
