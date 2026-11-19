import {
  DEFAULT_QUERY,
  exportHref,
  fromSearchParams,
  hasActiveFilters,
  toApiParams,
  toSearchParams,
  updateQuery,
  type DirectoryQuery,
} from './directoryQuery';

const params = (value: string) => new URLSearchParams(value);

describe('fromSearchParams', () => {
  it('uses the defaults for an empty URL: current employees, by name', () => {
    expect(fromSearchParams(params(''))).toEqual(DEFAULT_QUERY);
    expect(DEFAULT_QUERY).toMatchObject({
      countries: [],
      departments: [],
      jobTitles: [],
      status: 'active',
      sort: 'fullName',
    });
  });

  it('reads every setting from the URL, including several values per filter', () => {
    expect(
      fromSearchParams(
        params(
          'search=asha&country=IN&country=US&department=Engineering&jobTitle=Software+Engineer&jobTitle=Designer&status=all&sort=salary&order=desc&page=3&pageSize=50',
        ),
      ),
    ).toEqual({
      search: 'asha',
      countries: ['IN', 'US'],
      departments: ['Engineering'],
      jobTitles: ['Software Engineer', 'Designer'],
      status: 'all',
      sort: 'salary',
      order: 'desc',
      page: 3,
      pageSize: 50,
    });
  });

  it.each([
    ['page=abc', { page: 1 }],
    ['page=0', { page: 1 }],
    ['page=-2', { page: 1 }],
    ['sort=bonus', { sort: 'fullName' }],
    ['order=up', { order: 'asc' }],
    ['pageSize=7', { pageSize: 25 }],
    ['status=everyone', { status: 'active' }],
  ])('falls back to the default for the invalid value %s', (search, expected) => {
    expect(fromSearchParams(params(search))).toMatchObject(expected);
  });

  it('ignores empty and repeated values', () => {
    expect(fromSearchParams(params('search=&country=&country=IN&country=IN'))).toEqual({
      ...DEFAULT_QUERY,
      countries: ['IN'],
    });
  });
});

describe('toSearchParams', () => {
  it('writes nothing for the defaults, keeping URLs short', () => {
    expect(toSearchParams(DEFAULT_QUERY).toString()).toBe('');
  });

  it('repeats a filter for each chosen value and writes only non-default settings', () => {
    expect(
      toSearchParams({
        ...DEFAULT_QUERY,
        countries: ['IN', 'US'],
        status: 'left',
        page: 2,
      }).toString(),
    ).toBe('country=IN&country=US&status=left&page=2');
  });

  it('round-trips with fromSearchParams', () => {
    const query: DirectoryQuery = {
      search: 'sharma',
      countries: ['IN', 'GB'],
      departments: ['Sales', 'Product'],
      jobTitles: ['Account Executive'],
      status: 'all',
      sort: 'salary',
      order: 'desc',
      page: 4,
      pageSize: 100,
    };

    expect(fromSearchParams(toSearchParams(query))).toEqual(query);
  });
});

describe('updateQuery', () => {
  const onPage3: DirectoryQuery = { ...DEFAULT_QUERY, page: 3 };

  it('goes back to page 1 when a filter changes', () => {
    expect(updateQuery(onPage3, { countries: ['US'] })).toMatchObject({
      countries: ['US'],
      page: 1,
    });
  });

  it('goes back to page 1 when the status or sort changes', () => {
    expect(updateQuery(onPage3, { status: 'left' }).page).toBe(1);
    expect(updateQuery(onPage3, { sort: 'salary' }).page).toBe(1);
  });

  it('keeps the requested page when only the page changes', () => {
    expect(updateQuery(onPage3, { page: 4 }).page).toBe(4);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults and true when anything narrows or widens the list', () => {
    expect(hasActiveFilters(DEFAULT_QUERY)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, search: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, jobTitles: ['Designer'] })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, status: 'all' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, sort: 'salary', page: 2 })).toBe(false);
  });
});

describe('toApiParams', () => {
  it('maps the query to the API’s parameters, leaving out empty filters', () => {
    expect(toApiParams({ ...DEFAULT_QUERY, countries: ['IN', 'US'] })).toEqual({
      country: ['IN', 'US'],
      status: 'active',
      sort: 'fullName',
      order: 'asc',
      page: 1,
      pageSize: 25,
    });
  });
});

describe('exportHref', () => {
  it('links to the CSV export with the filters, status and sort, but not the page', () => {
    const href = exportHref({
      ...DEFAULT_QUERY,
      countries: ['IN', 'US'],
      search: 'a b',
      status: 'all',
      sort: 'salary',
      order: 'desc',
      page: 5,
      pageSize: 50,
    });

    expect(href).toBe(
      '/api/employees/export?search=a+b&country=IN&country=US&status=all&sort=salary&order=desc',
    );
  });
});
