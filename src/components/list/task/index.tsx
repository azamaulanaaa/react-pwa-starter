import { useMemo } from "react";
import { Check, Trash } from "lucide-react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  RowData,
  useReactTable,
} from "@tanstack/react-table";

import { useTranslation } from "@/components/i18n_context.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    onToggleDone?: (id: number, isDone: boolean) => void | Promise<void>;
    onDelete?: (id: number) => void | Promise<void>;
  }
}

export type Task = {
  id: number;
  isDone: boolean;
  description: string;
};

export type ListTaskProps = {
  data: Task[];
  onToggleDone: (id: number, isDone: boolean) => void | Promise<void>;
  onDelete: (id: number) => void | Promise<void>;
};

export function ListTask(props: ListTaskProps) {
  const { t } = useTranslation("ui");

  const columns: ColumnDef<Task>[] = useMemo(() => [
    {
      accessorKey: "isDone",
      cell: ({ row }) => {
        return (
          <Checkbox
            checked={row.getValue("isDone")}
            onCheckedChange={(checked) =>
              table.options.meta?.onToggleDone?.(row.original.id, !!checked)}
          />
        );
      },
      header: () => <Check />,
    },
    {
      accessorKey: "description",
      cell: ({ row }) => (
        <p className="text-foreground">{row.getValue("description")}</p>
      ),
      header: () => t("list-task-description"),
    },
    {
      accessorKey: "id",
      cell: ({ row }) => (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="delete"
                size="icon"
                variant="destructive"
                onClick={() => table.options.meta?.onDelete?.(row.original.id)}
              />
            }
          >
            <Trash />
          </TooltipTrigger>
          <TooltipPopup>Delete</TooltipPopup>
        </Tooltip>
      ),
      header: () => t("list-task-action"),
    },
  ], [t]);

  const table = useReactTable({
    columns,
    data: props.data,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      onToggleDone: props.onToggleDone,
      onDelete: props.onDelete,
    },
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length
          ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                data-state={row.getIsSelected() && "selected"}
                key={row.id}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )
          : (
            <TableRow>
              <TableCell className="h-24 text-center" colSpan={columns.length}>
                No results.
              </TableCell>
            </TableRow>
          )}
      </TableBody>
    </Table>
  );
}
