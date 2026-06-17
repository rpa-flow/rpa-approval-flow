import type { PaginationMetadata } from "@/lib/pagination";

type PaginationControlsProps = {
  pagination: PaginationMetadata;
  pageSizeOptions?: number[];
  itemLabel?: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function PaginationControls({
  pagination,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  itemLabel = "registro(s)",
  loading = false,
  onPageChange,
  onPageSizeChange
}: PaginationControlsProps) {
  const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p>{pageStart}-{pageEnd} de {pagination.total} {itemLabel}</p>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <label className="flex w-auto flex-row items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          Por página
          <select
            className="w-auto min-w-20"
            value={pagination.pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary min-h-0 px-3 py-1.5 text-sm"
          disabled={!pagination.hasPreviousPage || loading}
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          Anterior
        </button>
        <span className="badge badge-slate">Página {pagination.page} de {pagination.totalPages}</span>
        <button
          type="button"
          className="btn-secondary min-h-0 px-3 py-1.5 text-sm"
          disabled={!pagination.hasNextPage || loading}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
