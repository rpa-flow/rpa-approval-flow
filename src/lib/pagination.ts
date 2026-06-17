export type PaginationMetadata = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function getPositiveInt(value: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

export function shouldUsePaginatedResponse(searchParams: URLSearchParams) {
  return searchParams.has("page") || searchParams.has("pageSize") || searchParams.get("paginated") === "true";
}

export function getPaginationParams(searchParams: URLSearchParams, defaultPageSize = DEFAULT_PAGE_SIZE) {
  return {
    page: getPositiveInt(searchParams.get("page"), 1),
    pageSize: getPositiveInt(searchParams.get("pageSize"), defaultPageSize, MAX_PAGE_SIZE)
  };
}

export function getPaginationMetadata(total: number, requestedPage: number, pageSize: number): PaginationMetadata {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}
