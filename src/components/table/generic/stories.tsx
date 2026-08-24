import { useState } from "react";
import type { Story, StoryDefault } from "@ladle/react";
import { ColumnDef, RowSelectionState } from "@tanstack/react-table";

import { TableGeneric, TableGenericProps } from "./index.tsx";
import { Badge } from "@/components/ui/badge.tsx";

export default {
  title: "Table / Generic",
} as StoryDefault;

const data = [
  { id: 1, name: "John", status: "Online" },
  { id: 2, name: "Sophia", status: "Online" },
  { id: 3, name: "Yusuf", status: "Offline" },
];
const columns: ColumnDef<typeof data[number]>[] = [
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

export const Base: Story<TableGenericProps<typeof data[number]>> = (props) => {
  const [rowSelections, setRowSelections] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState({});

  return (
    <TableGeneric
      {...props}
      rowSelection={rowSelections}
      onRowSelectionChange={(state) => setRowSelections(state)}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={setColumnVisibility}
      data={data}
    />
  );
};
Base.args = {
  columns,
};

export const Empty: Story<TableGenericProps<typeof data[number]>> = (props) => {
  return <TableGeneric {...props} />;
};
Empty.args = { columns, data: [] };
