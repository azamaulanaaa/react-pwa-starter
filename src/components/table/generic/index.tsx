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
import { InboxIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn.ts";
import { useTranslation } from "@/components/context/translation.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";

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
      RowSelectionState | ((state: RowSelectionState) => RowSelectionState),
  ) => void;
  columnVisibility?: ColumnVisibilityState;
  onColumnVisibilityChange?: (
    columnVisibility:
      | ColumnVisibilityState
      | ((state: ColumnVisibilityState) => ColumnVisibilityState),
  ) => void;
  containerRef?: Ref<HTMLDivElement>;
  getRowRefs?: (id: string) => Ref<HTMLTableRowElement>;
  loading?: boolean;
};

const LOADING_ROW_COUNT = 5;

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
          functionalUpdate(updater, previous),
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
          functionalUpdate(updater, previous),
        );
      }
      props.onColumnVisibilityChange?.(updater);
    },
    [props.columnVisibility, props.onColumnVisibilityChange],
  );

  const columns = useMemo<TableGenericColumnDef<TData>[]>(() => {
    const sourceColumns = props.columns.map((column) => {
      if (column.header !== "") return column;

      return {
        ...column,
        header: () => (
          <span className="sr-only">{t("table_generic_actions")}</span>
        ),
      } as TableGenericColumnDef<TData>;
    });

    if (!enableSelection) return sourceColumns;

    const selectionColumn: TableGenericColumnDef<TData> = {
      id: "select",
      enableHiding: false,
      cell: ({ row }) => {
        return (
          <Checkbox
            aria-label={t("table_generic_select_row", {
              id: row.id,
            })}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            disabled={!row.getCanSelect()}
          />
        );
      },
      header: ({ table }) => (
        <Checkbox
          aria-label={t("table_generic_select_all_row")}
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        />
      ),
    };

    return [selectionColumn, ...sourceColumns];
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
      aria-busy={props.loading || undefined}
      render={(containerProps) => {
        const containerClassName = containerProps.className
          ?.split(" ")
          .filter((name) => name !== "overflow-x-auto")
          .join(" ");

        return (
          <ScrollArea
            {...containerProps}
            className={cn(
              containerClassName,
              "border rounded-xl flex-1 min-h-0",
            )}
            scrollFade
            scrollbarGutter
            ref={props.containerRef}
          />
        );
      }}
    >
      <TableCaption className="sr-only">
        {t("table_generic_caption")}
      </TableCaption>
      <TableHeader className="sticky top-0 z-10 bg-background">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
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
        {props.loading ? (
          Array.from({ length: LOADING_ROW_COUNT }, (_, rowIndex) => (
            <TableRow key={`loading-${rowIndex}`}>
              {columns.map((_, columnIndex) => (
                <TableCell key={`loading-${rowIndex}-${columnIndex}`}>
                  <Skeleton className="h-4 w-full min-w-16" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              data-state={row.getIsSelected() && "selected"}
              key={row.id}
              ref={props.getRowRefs?.(row.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              className="whitespace-normal p-0"
              colSpan={columns.length}
            >
              <Empty className="py-10 md:py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <InboxIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("table_generic_empty")}</EmptyTitle>
                  <EmptyDescription>
                    {t("table_generic_empty_description")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
