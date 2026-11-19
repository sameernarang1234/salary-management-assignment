import type { EmployeeListParams, EmployeeSortField, EmployeeStatusFilter } from '../../api/types';

/** The directory's search, filters, sort and page: kept in the URL so views can be shared. */
export interface DirectoryQuery {
  search?: string;
  /** Any of these match; empty means no filter. */
  countries: string[];
  departments: string[];
  jobTitles: string[];
  status: EmployeeStatusFilter;
  sort: EmployeeSortField;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;

const SORT_FIELDS: readonly EmployeeSortField[] = [
  'fullName',
  'jobTitle',
  'department',
  'country',
  'hireDate',
  'salary',
];

const STATUSES: readonly EmployeeStatusFilter[] = ['active', 'left', 'all'];

export const DEFAULT_QUERY: DirectoryQuery = {
  countries: [],
  departments: [],
  jobTitles: [],
  status: 'active',
  sort: 'fullName',
  order: 'asc',
  page: 1,
  pageSize: 25,
};

/** URL parameter name for each list filter (singular, repeated once per value). */
const LIST_PARAMS = [
  ['countries', 'country'],
  ['departments', 'department'],
  ['jobTitles', 'jobTitle'],
] as const;

const positiveInteger = (value: string | null) => {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number > 0 ? number : undefined;
};

/** Non-empty values in their first-seen order, without repeats. */
const distinctValues = (values: string[]) => [...new Set(values.filter(Boolean))];

/** Reads the query from the URL; anything missing or invalid falls back to the default. */
export function fromSearchParams(params: URLSearchParams): DirectoryQuery {
  const sort = params.get('sort') as EmployeeSortField | null;
  const order = params.get('order');
  const status = params.get('status') as EmployeeStatusFilter | null;
  const pageSize = positiveInteger(params.get('pageSize'));

  return {
    search: params.get('search') || undefined,
    countries: distinctValues(params.getAll('country')),
    departments: distinctValues(params.getAll('department')),
    jobTitles: distinctValues(params.getAll('jobTitle')),
    status: status && STATUSES.includes(status) ? status : DEFAULT_QUERY.status,
    sort: sort && SORT_FIELDS.includes(sort) ? sort : DEFAULT_QUERY.sort,
    order: order === 'asc' || order === 'desc' ? order : DEFAULT_QUERY.order,
    page: positiveInteger(params.get('page')) ?? DEFAULT_QUERY.page,
    pageSize:
      pageSize !== undefined && (PAGE_SIZES as readonly number[]).includes(pageSize)
        ? pageSize
        : DEFAULT_QUERY.pageSize,
  };
}

/** Writes only values that differ from the defaults, keeping URLs short and readable. */
export function toSearchParams(query: DirectoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) {
    params.set('search', query.search);
  }
  for (const [field, name] of LIST_PARAMS) {
    for (const value of query[field]) {
      params.append(name, value);
    }
  }
  for (const key of ['status', 'sort', 'order', 'page', 'pageSize'] as const) {
    if (query[key] !== DEFAULT_QUERY[key]) {
      params.set(key, String(query[key]));
    }
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
    query.search ||
    query.countries.length ||
    query.departments.length ||
    query.jobTitles.length ||
    query.status !== DEFAULT_QUERY.status,
  );
}

export function toApiParams(query: DirectoryQuery): EmployeeListParams {
  const params: EmployeeListParams = {
    status: query.status,
    sort: query.sort,
    order: query.order,
    page: query.page,
    pageSize: query.pageSize,
  };
  if (query.search) {
    params.search = query.search;
  }
  for (const [field, name] of LIST_PARAMS) {
    if (query[field].length > 0) {
      params[name] = query[field];
    }
  }
  return params;
}

/** The CSV export of the current filters, status and sort (all pages). */
export function exportHref(query: DirectoryQuery): string {
  const params = new URLSearchParams();
  if (query.search) {
    params.set('search', query.search);
  }
  for (const [field, name] of LIST_PARAMS) {
    for (const value of query[field]) {
      params.append(name, value);
    }
  }
  params.set('status', query.status);
  params.set('sort', query.sort);
  params.set('order', query.order);
  return `/api/employees/export?${params.toString()}`;
}
