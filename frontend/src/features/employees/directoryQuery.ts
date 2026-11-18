import type { EmployeeListParams, EmployeeSortField } from '../../api/types';

/** The directory's search, filters, sort and page: kept in the URL so views can be shared. */
export interface DirectoryQuery {
  search?: string;
  country?: string;
  department?: string;
  jobTitle?: string;
  sort: EmployeeSortField;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
  includeLeft: boolean;
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;

const SORT_FIELDS: readonly EmployeeSortField[] = [
  'fullName',
  'jobTitle',
  'department',
  'country',
  'hireDate',
];

export const DEFAULT_QUERY: DirectoryQuery = {
  sort: 'fullName',
  order: 'asc',
  page: 1,
  pageSize: 25,
  includeLeft: false,
};

const positiveInteger = (value: string | null) => {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number > 0 ? number : undefined;
};

/** Reads the query from the URL; anything missing or invalid falls back to the default. */
export function fromSearchParams(params: URLSearchParams): DirectoryQuery {
  const sort = params.get('sort') as EmployeeSortField | null;
  const order = params.get('order');
  const pageSize = positiveInteger(params.get('pageSize'));

  return {
    search: params.get('search') || undefined,
    country: params.get('country') || undefined,
    department: params.get('department') || undefined,
    jobTitle: params.get('jobTitle') || undefined,
    sort: sort && SORT_FIELDS.includes(sort) ? sort : DEFAULT_QUERY.sort,
    order: order === 'asc' || order === 'desc' ? order : DEFAULT_QUERY.order,
    page: positiveInteger(params.get('page')) ?? DEFAULT_QUERY.page,
    pageSize:
      pageSize !== undefined && (PAGE_SIZES as readonly number[]).includes(pageSize)
        ? pageSize
        : DEFAULT_QUERY.pageSize,
    includeLeft: params.get('includeLeft') === 'true',
  };
}

/** Writes only values that differ from the defaults, keeping URLs short and readable. */
export function toSearchParams(query: DirectoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  const keys = [
    'search',
    'country',
    'department',
    'jobTitle',
    'sort',
    'order',
    'page',
    'pageSize',
  ] as const;
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== '' && value !== DEFAULT_QUERY[key]) {
      params.set(key, String(value));
    }
  }
  if (query.includeLeft) {
    params.set('includeLeft', 'true');
  }
  return params;
}

/** Changing anything but the page goes back to page 1, so the HR Manager never lands on an empty page. */
export function updateQuery(
  current: DirectoryQuery,
  changes: Partial<DirectoryQuery>,
): DirectoryQuery {
  const onlyPage = Object.keys(changes).every((key) => key === 'page');
  return { ...current, ...changes, ...(onlyPage ? {} : { page: changes.page ?? 1 }) };
}

export function hasActiveFilters(query: DirectoryQuery): boolean {
  return Boolean(
    query.search || query.country || query.department || query.jobTitle || query.includeLeft,
  );
}

export function toApiParams(query: DirectoryQuery): EmployeeListParams {
  const { includeLeft, ...rest } = query;
  const params: EmployeeListParams = { ...rest };
  for (const key of ['search', 'country', 'department', 'jobTitle'] as const) {
    if (params[key] === undefined) {
      delete params[key];
    }
  }
  return includeLeft ? { ...params, includeLeft: 'true' } : params;
}

/** The CSV export of the current filters and sort (all pages). */
export function exportHref(query: DirectoryQuery): string {
  const params = new URLSearchParams();
  for (const key of ['search', 'country', 'department', 'jobTitle'] as const) {
    const value = query[key];
    if (value) {
      params.set(key, value);
    }
  }
  params.set('sort', query.sort);
  params.set('order', query.order);
  if (query.includeLeft) {
    params.set('includeLeft', 'true');
  }
  return `/api/employees/export?${params.toString()}`;
}
