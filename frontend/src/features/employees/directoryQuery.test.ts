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
  it('uses the defaults for an empty URL', () => {
    expect(fromSearchParams(params(''))).toEqual(DEFAULT_QUERY);
  });

  it('reads every setting from the URL', () => {
    expect(
      fromSearchParams(
        params(
          'search=asha&country=IN&department=Engineering&jobTitle=Software+Engineer&sort=hireDate&order=desc&page=3&pageSize=50&includeLeft=true',
        ),
      ),
    ).toEqual({
      search: 'asha',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Software Engineer',
      sort: 'hireDate',
      order: 'desc',
      page: 3,
      pageSize: 50,
      includeLeft: true,
    });
  });

  it.each([
    ['page=abc', { page: 1 }],
    ['page=0', { page: 1 }],
    ['page=-2', { page: 1 }],
    ['sort=salary', { sort: 'fullName' }],
    ['order=up', { order: 'asc' }],
    ['pageSize=7', { pageSize: 25 }],
    ['includeLeft=yes', { includeLeft: false }],
  ])('falls back to the default for the invalid value %s', (search, expected) => {
    expect(fromSearchParams(params(search))).toMatchObject(expected);
  });

  it('ignores empty values', () => {
    expect(fromSearchParams(params('search=&country='))).toEqual(DEFAULT_QUERY);
  });
});

describe('toSearchParams', () => {
  it('writes nothing for the defaults, keeping URLs short', () => {
    expect(toSearchParams(DEFAULT_QUERY).toString()).toBe('');
  });

  it('writes only the values that differ from the defaults', () => {
    expect(
      toSearchParams({ ...DEFAULT_QUERY, country: 'IN', page: 2, includeLeft: true }).toString(),
    ).toBe('country=IN&page=2&includeLeft=true');
  });

  it('round-trips with fromSearchParams', () => {
    const query: DirectoryQuery = {
      search: 'sharma',
      country: 'IN',
      department: 'Sales',
      jobTitle: 'Account Executive',
      sort: 'department',
      order: 'desc',
      page: 4,
      pageSize: 100,
      includeLeft: true,
    };

    expect(fromSearchParams(toSearchParams(query))).toEqual(query);
  });
});

describe('updateQuery', () => {
  const onPage3: DirectoryQuery = { ...DEFAULT_QUERY, page: 3 };

  it('goes back to page 1 when a filter changes', () => {
    expect(updateQuery(onPage3, { country: 'US' })).toMatchObject({ country: 'US', page: 1 });
  });

  it('goes back to page 1 when the sort changes', () => {
    expect(updateQuery(onPage3, { sort: 'hireDate' }).page).toBe(1);
  });

  it('keeps the requested page when only the page changes', () => {
    expect(updateQuery(onPage3, { page: 4 }).page).toBe(4);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults and true when anything narrows or widens the list', () => {
    expect(hasActiveFilters(DEFAULT_QUERY)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, search: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, includeLeft: true })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_QUERY, sort: 'hireDate', page: 2 })).toBe(false);
  });
});

describe('toApiParams', () => {
  it('maps the query to the API’s parameters, leaving out what is not set', () => {
    expect(toApiParams({ ...DEFAULT_QUERY, country: 'IN' })).toEqual({
      country: 'IN',
      sort: 'fullName',
      order: 'asc',
      page: 1,
      pageSize: 25,
    });
    expect(toApiParams({ ...DEFAULT_QUERY, includeLeft: true }).includeLeft).toBe('true');
  });
});

describe('exportHref', () => {
  it('links to the CSV export with the filters and sort, but not the page', () => {
    const href = exportHref({
      ...DEFAULT_QUERY,
      country: 'IN',
      search: 'a b',
      order: 'desc',
      page: 5,
      pageSize: 50,
    });

    expect(href).toBe('/api/employees/export?search=a+b&country=IN&sort=fullName&order=desc');
  });
});
