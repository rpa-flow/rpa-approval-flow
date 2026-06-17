import { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LoadingState } from "@/components/ui-kit/loading-state";

export type DataTableColumn<T> = { key: string; header: ReactNode; className?: string; cell: (row: T) => ReactNode };

export function DataTable<T>({ columns, data, getRowKey, loading, emptyTitle = "Nenhum registro encontrado", emptyDescription, actions }: { columns: DataTableColumn<T>[]; data: T[]; getRowKey: (row: T) => string; loading?: boolean; emptyTitle?: string; emptyDescription?: string; actions?: (row: T) => ReactNode }) {
  if (loading) return <LoadingState />;
  if (!data.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-container-lowest shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => <TableHead key={column.key} className={column.className}>{column.header}</TableHead>)}
              {actions && <TableHead className="w-32 whitespace-nowrap text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => <TableRow key={getRowKey(row)}>{columns.map((column) => <TableCell key={column.key} className={column.className}>{column.cell(row)}</TableCell>)}{actions && <TableCell className="whitespace-nowrap text-right">{actions(row)}</TableCell>}</TableRow>)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
