import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Switch,
  TablePagination,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useGetMetaQuery, useListEmployeesQuery } from '../../api/api';
import type { EmployeeSortField } from '../../api/types';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState } from '../../components/states';
import { formatCount } from '../../lib/format';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import {
  PAGE_SIZES,
  exportHref,
  fromSearchParams,
  hasActiveFilters,
  toApiParams,
  toSearchParams,
  updateQuery,
  type DirectoryQuery,
} from './directoryQuery';
import { EmployeeCards, EmployeeTable } from './EmployeeList';

/** Sort choices for phones, where there are no column headers to click. */
const MOBILE_SORTS: { value: string; label: string }[] = [
  { value: 'fullName:asc', label: 'Name (A–Z)' },
  { value: 'fullName:desc', label: 'Name (Z–A)' },
  { value: 'hireDate:desc', label: 'Most recently hired' },
  { value: 'hireDate:asc', label: 'Longest serving' },
  { value: 'department:asc', label: 'Department' },
  { value: 'country:asc', label: 'Country' },
];

export function EmployeesPage() {
  const theme = useTheme();
  // The table needs about 750px beside the 300px sidebar; narrower screens get cards.
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [searchParams, setSearchParams] = useSearchParams();
  const query = fromSearchParams(searchParams);

  const [searchText, setSearchText] = useState(query.search ?? '');
  const debouncedSearch = useDebouncedValue(searchText.trim());

  const meta = useGetMetaQuery();
  const employees = useListEmployeesQuery(toApiParams(query));

  const setQuery = (changes: Partial<DirectoryQuery>) =>
    setSearchParams((current) => toSearchParams(updateQuery(fromSearchParams(current), changes)));

  // Push the search box into the URL once typing pauses; the URL drives the request.
  useEffect(() => {
    setSearchParams((current) => {
      const currentQuery = fromSearchParams(current);
      return (currentQuery.search ?? '') === debouncedSearch
        ? current
        : toSearchParams(updateQuery(currentQuery, { search: debouncedSearch || undefined }));
    });
  }, [debouncedSearch, setSearchParams]);

  const sortBy = (field: EmployeeSortField) =>
    setQuery({
      sort: field,
      order: query.sort === field && query.order === 'asc' ? 'desc' : 'asc',
    });

  const clearFilters = () => {
    setSearchText('');
    setQuery({
      search: undefined,
      country: undefined,
      department: undefined,
      jobTitle: undefined,
      includeLeft: false,
    });
  };

  const countryNames = new Map(meta.data?.countries.map((country) => [country.code, country.name]));
  const countryName = (code: string) => countryNames.get(code) ?? code;
  const page = employees.data;
  const filterValue = (value: string | undefined) => (meta.data ? (value ?? '') : '');

  return (
    <>
      <PageHeader
        title="Employees"
        description="Find any employee, see their salary and keep records up to date. Salaries are in each employee's local currency, with a USD equivalent."
        actions={
          <Button
            variant="outlined"
            startIcon={<DownloadRoundedIcon />}
            href={exportHref(query)}
            download
          >
            Export CSV
          </Button>
        }
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 }, '&:last-child': { pb: { xs: 2.5, md: 3 } } }}>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              alignItems: 'center',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '2fr 1fr 1fr 1.4fr' },
            }}
          >
            <TextField
              label="Search name or email"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              sx={{ gridColumn: { sm: '1 / -1', lg: 'auto' } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              select
              label="Country"
              value={filterValue(query.country)}
              onChange={(event) => setQuery({ country: event.target.value || undefined })}
            >
              <MenuItem value="">All countries</MenuItem>
              {meta.data?.countries.map((country) => (
                <MenuItem key={country.code} value={country.code}>
                  {country.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Department"
              value={filterValue(query.department)}
              onChange={(event) => setQuery({ department: event.target.value || undefined })}
            >
              <MenuItem value="">All departments</MenuItem>
              {meta.data?.filterOptions.departments.map((department) => (
                <MenuItem key={department} value={department}>
                  {department}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Job title"
              value={filterValue(query.jobTitle)}
              onChange={(event) => setQuery({ jobTitle: event.target.value || undefined })}
            >
              <MenuItem value="">All job titles</MenuItem>
              {meta.data?.filterOptions.jobTitles.map((jobTitle) => (
                <MenuItem key={jobTitle} value={jobTitle}>
                  {jobTitle}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              mt: 1.5,
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={query.includeLeft}
                  onChange={(event) => setQuery({ includeLeft: event.target.checked })}
                  slotProps={{ input: { role: 'switch' } }}
                />
              }
              label="Show leavers"
            />
            <Button onClick={clearFilters} disabled={!hasActiveFilters(query) && !searchText}>
              Clear filters
            </Button>
          </Box>
        </CardContent>
      </Card>

      {employees.isError && (
        <Box sx={{ mb: 3 }}>
          <ErrorState message="Could not load employees." onRetry={() => employees.refetch()} />
        </Box>
      )}

      <Card>
        {employees.isFetching && <LinearProgress aria-label="Loading employees" />}
        <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              mb: 2,
            }}
          >
            <Typography variant="h2" aria-live="polite">
              {page
                ? `${formatCount(page.total)} employee${page.total === 1 ? '' : 's'}`
                : 'Employees'}
            </Typography>
            {!isDesktop && page && page.total > 0 && (
              <TextField
                select
                size="small"
                label="Sort by"
                value={
                  MOBILE_SORTS.some((option) => option.value === `${query.sort}:${query.order}`)
                    ? `${query.sort}:${query.order}`
                    : ''
                }
                onChange={(event) => {
                  const [sort, order] = event.target.value.split(':') as [
                    EmployeeSortField,
                    'asc' | 'desc',
                  ];
                  setQuery({ sort, order });
                }}
                sx={{ minWidth: 200 }}
              >
                {MOBILE_SORTS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          {page && page.total === 0 && (
            <EmptyState
              title="No employees match"
              description="Try a different search, or clear the filters to see everyone."
              action={
                hasActiveFilters(query) && (
                  <Button variant="outlined" onClick={clearFilters}>
                    Show everyone
                  </Button>
                )
              }
            />
          )}

          {page &&
            page.items.length > 0 &&
            (isDesktop ? (
              <EmployeeTable
                employees={page.items}
                countryName={countryName}
                sort={query.sort}
                order={query.order}
                onSort={sortBy}
              />
            ) : (
              <EmployeeCards employees={page.items} countryName={countryName} />
            ))}

          {page && page.total > 0 && (
            <TablePagination
              component="div"
              count={page.total}
              page={query.page - 1}
              rowsPerPage={query.pageSize}
              rowsPerPageOptions={[...PAGE_SIZES]}
              onPageChange={(_event, newPage) => setQuery({ page: newPage + 1 })}
              onRowsPerPageChange={(event) => setQuery({ pageSize: Number(event.target.value) })}
              sx={{ mt: 1 }}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
