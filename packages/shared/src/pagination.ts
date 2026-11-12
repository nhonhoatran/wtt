export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  field: string;
  direction: SortDirection;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationQueryShape {
  page: number;
  pageSize: number;
  sort?: SortSpec;
  q?: string;
  filter: Record<string, string>;
}
