import { type Ref, useMemo, useRef } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Row,
  RowSelectionState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";

import { cn } from "@/lib/cn.ts";
import { useTranslation } from "@/components/context/translation.tsx";
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
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

export type TableGenericProps<TData = unknown> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  getRowId?: (
    row: TData,
    index: number,
    parent?: Row<TData> | undefined,
  ) => string;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (
    state:
      | RowSelectionState
      | ((state: RowSelectionState) => RowSelectionState),
  ) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (
    columnVisibility:
      | VisibilityState
      | ((state: VisibilityState) => VisibilityState),
  ) => void;
  containerRef?: Ref<HTMLDivElement>;
  getRowRefs?: (id: string) => Ref<HTMLTableRowElement>;
};

export function TableGeneric<TData>(
  props: TableGenericProps<TData>,
) {
  const { t } = useTranslation();

  const enableSelection = Boolean(
    props.rowSelection || props.onRowSelectionChange,
  );

  const onRowSelectionChangeRef = useRef(props.onRowSelectionChange);
  onRowSelectionChangeRef.current = props.onRowSelectionChange;

  const onColumnVisibilityChangeRef = useRef(props.onColumnVisibilityChange);
  onColumnVisibilityChangeRef.current = props.onColumnVisibilityChange;

  const getRowIdRef = useRef(props.getRowId);
  getRowIdRef.current = props.getRowId;

  const columns = useMemo<ColumnDef<TData>[]>(() => {
    if (!enableSelection) return props.columns;

    const selectionColumn: ColumnDef<TData> = {
      id: "select",
      enableHiding: false,
      cell: ({ row }) => {
        return (
          <Tooltip>
            <TooltipTrigger>
              <Checkbox
                aria-label={t("table_generic_select_row", {
                  id: row.id,
                })}
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                disabled={!row.getCanSelect()}
              />
            </TooltipTrigger>
            <TooltipPopup>
              {t("table_generic_select_row", {
                id: row.id,
              })}
            </TooltipPopup>
          </Tooltip>
        );
      },
      header: ({ table }) => (
        <Tooltip>
          <TooltipTrigger>
            <Checkbox
              aria-label={t("table_generic_select_all_row")}
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
            />
          </TooltipTrigger>
          <TooltipPopup>{t("table_generic_select_all_row")}</TooltipPopup>
        </Tooltip>
      ),
    };

    return [selectionColumn, ...props.columns];
  }, [enableSelection, props.columns, t]);

  const state = useMemo(
    () => ({
      ...(props.rowSelection !== undefined &&
        { rowSelection: props.rowSelection }),
      ...(props.columnVisibility !== undefined &&
        { columnVisibility: props.columnVisibility }),
    }),
    [props.rowSelection, props.columnVisibility],
  );

  const table = useReactTable({
    columns,
    data: props.data,
    getRowId: props.getRowId,
    state,
    onRowSelectionChange: props.onRowSelectionChange,
    onColumnVisibilityChange: props.onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table
      render={(containerProps) => (
        <ScrollArea
          {...containerProps}
          className={cn(
            containerProps.className,
            "border rounded-md flex-1 min-h-0",
          )}
          scrollFade
          scrollbarGutter
          ref={props.containerRef}
        />
      )}
    >
      <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur-xs">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <TableHead key={header.id} colSpan={header.colSpan}>
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
                ref={props.getRowRefs?.(row.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-foreground">
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )
          : (
            <TableRow>
              <TableCell
                className="h-24 text-center"
                colSpan={columns.length}
              >
                {t("table_generic_empty")}
              </TableCell>
            </TableRow>
          )}
      </TableBody>
    </Table>
  );
}
