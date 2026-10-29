import { type Ref, useCallback, useMemo, useState } from "react";
import {
  type ColumnDef,
  type ColumnVisibilityState,
  columnVisibilityFeature,
  flexRender,
  functionalUpdate,
  type Row,
  type RowData,
  rowSelectionFeature,
  type RowSelectionState,
  tableFeatures,
  type Updater,
  useTable,
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

/**
 * The features that every TableGeneric instance needs. The object is defined
 * once, outside the component, so the table type stays stable and Vite can
 * drop the features that this module does not import.
 */
export const tableGenericFeatures = tableFeatures({
  rowSelectionFeature,
  columnVisibilityFeature,
});

export type TableGenericFeatures = typeof tableGenericFeatures;

export type TableGenericColumnDef<TData extends RowData> = ColumnDef<
  TableGenericFeatures,
  TData
>;

export type TableGenericProps<TData extends RowData = RowData> = {
  columns: TableGenericColumnDef<TData>[];
  data: TData[];
  getRowId?: (
    row: TData,
    index: number,
    parent?: Row<TableGenericFeatures, TData>,
  ) => string;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (
    state:
      | RowSelectionState
      | ((state: RowSelectionState) => RowSelectionState),
  ) => void;
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (
    columnVisibility:
      | ColumnVisibilityState
      | ((state: ColumnVisibilityState) => ColumnVisibilityState),
  ) => void;
  containerRef?: Ref<HTMLDivElement>;
  getRowRefs?: (id: string) => Ref<HTMLTableRowElement>;
};

export function TableGeneric<TData extends RowData>(
  props: TableGenericProps<TData>,
) {
  const { t } = useTranslation();

  const enableSelection = Boolean(
    props.rowSelection || props.onRowSelectionChange,
  );
  const enableVisibility = Boolean(
    props.columnVisibility || props.onColumnVisibilityChange,
  );

  // v9 treats a change callback as an external owner, so a callback without a
  // value leaves the table slice unchanged. Keep the v8 behavior of an
  // internally owned slice by holding the value here while the caller supplies
  // no controlled value.
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const [internalColumnVisibility, setInternalColumnVisibility] =
    useState<ColumnVisibilityState>({});

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      if (props.rowSelection === undefined) {
        setInternalRowSelection((previous) =>
          functionalUpdate(updater, previous)
        );
      }
      props.onRowSelectionChange?.(updater);
    },
    [props.rowSelection, props.onRowSelectionChange],
  );

  const handleColumnVisibilityChange = useCallback(
    (updater: Updater<ColumnVisibilityState>) => {
      if (props.columnVisibility === undefined) {
        setInternalColumnVisibility((previous) =>
          functionalUpdate(updater, previous)
        );
      }
      props.onColumnVisibilityChange?.(updater);
    },
    [props.columnVisibility, props.onColumnVisibilityChange],
  );

  const columns = useMemo<TableGenericColumnDef<TData>[]>(() => {
    if (!enableSelection) return props.columns;

    const selectionColumn: TableGenericColumnDef<TData> = {
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
              indeterminate={table.getIsSomePageRowsSelected() &&
                !table.getIsAllPageRowsSelected()}
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
      ...(enableSelection && {
        rowSelection: props.rowSelection ?? internalRowSelection,
      }),
      ...(enableVisibility && {
        columnVisibility: props.columnVisibility ?? internalColumnVisibility,
      }),
    }),
    [
      enableSelection,
      enableVisibility,
      internalColumnVisibility,
      internalRowSelection,
      props.columnVisibility,
      props.rowSelection,
    ],
  );

  const table = useTable({
    features: tableGenericFeatures,
    columns,
    data: props.data,
    getRowId: props.getRowId,
    state,
    onRowSelectionChange: enableSelection
      ? handleRowSelectionChange
      : undefined,
    onColumnVisibilityChange: enableVisibility
      ? handleColumnVisibilityChange
      : undefined,
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
