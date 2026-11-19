import {
  Box,
  Card,
  CardContent,
  LinearProgress,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Fragment, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  useGetCostByDepartmentQuery,
  useGetPayByCountryQuery,
  useGetPayByJobTitleQuery,
} from '../../api/api';
import type { CountryPay, SalaryBand } from '../../api/types';
import { SectionCard } from '../../components/SectionCard';
import { EmptyState, ErrorState } from '../../components/states';
import { visuallyHidden } from '../../components/visuallyHidden';
import { formatCompactUsd, formatCount, formatMoney } from '../../lib/format';
import { palette } from '../../theme';

const numberCell = { whiteSpace: 'nowrap' } as const;

/** Phones get tighter charts: smaller tick labels and narrower label columns. */
function useIsNarrow(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

/** Shared look for chart axis titles ("Number of employees", "Department", …). */
const AXIS_TITLE = {
  fill: palette.muted,
  fontSize: 13,
  style: { fontWeight: 600 },
} as const;

/** "How do we pay people?": headcount per USD salary band. */
export function DistributionSection({ bands }: { bands: SalaryBand[] }) {
  const isNarrow = useIsNarrow();
  return (
    <SectionCard
      title="Salary distribution"
      subtitle="Active employees by total annual salary, converted to USD"
    >
      <Box aria-hidden sx={{ height: isNarrow ? 360 : 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bands} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.line} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: isNarrow ? 10 : 12 }}
              interval={0}
              // Steeper on phones so the eight salary ranges don't run into each other.
              angle={isNarrow ? -50 : -20}
              textAnchor="end"
              dy={4}
              height={isNarrow ? 110 : 78}
              label={{
                ...AXIS_TITLE,
                value: 'Salary range (USD per year)',
                position: 'insideBottom',
              }}
            />
            <YAxis
              tickFormatter={formatCount}
              tick={{ fontSize: 12 }}
              width={72}
              label={{
                ...AXIS_TITLE,
                value: 'Number of employees',
                angle: -90,
                position: 'insideLeft',
                style: { ...AXIS_TITLE.style, textAnchor: 'middle' },
              }}
            />
            <Tooltip formatter={(value) => [formatCount(Number(value)), 'Employees']} />
            <Bar dataKey="headcount" fill={palette.brown} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Table aria-label="Salary distribution" sx={visuallyHidden}>
        <TableHead>
          <TableRow>
            <TableCell>Salary band (USD)</TableCell>
            <TableCell>Employees</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {bands.map((band) => (
            <TableRow key={band.label}>
              <TableCell>{band.label}</TableCell>
              <TableCell>{formatCount(band.headcount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

/** Tables need about 720px beside the sidebar; narrower screens get one card per row. */
function useWideLayout(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('lg'));
}

/** Tighter cell padding (8px instead of 16px) so wide tables fit beside the sidebar. */
const compactTable = {
  '& th, & td': { px: 1 },
  '& th:first-of-type, & td:first-of-type': { pl: 0 },
  '& th:last-of-type, & td:last-of-type': { pr: 0 },
} as const;

/** "₹9,74,000 – ₹63,24,000": each amount stays whole, and the range wraps at the dash. */
function MoneyRange({ min, max, currency }: { min: number; max: number; currency: string }) {
  return (
    <>
      <Box component="span" sx={numberCell}>
        {formatMoney(min, currency)}
      </Box>{' '}
      –{' '}
      <Box component="span" sx={numberCell}>
        {formatMoney(max, currency)}
      </Box>
    </>
  );
}

interface CardItem {
  key: string;
  title: string;
  subtitle?: string;
  stats: [label: string, value: ReactNode][];
}

/** One card per row, for screens too narrow for the table. */
function StatCardList({ label, items }: { label: string; items: CardItem[] }) {
  return (
    <Box
      component="ul"
      aria-label={label}
      sx={{
        listStyle: 'none',
        p: 0,
        m: 0,
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
      }}
    >
      {items.map((item) => (
        <Card component="li" key={item.key} sx={{ borderRadius: 5, boxShadow: 'none' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
            {item.subtitle && (
              <Typography variant="body2" color="text.secondary">
                {item.subtitle}
              </Typography>
            )}
            <Box
              component="dl"
              sx={{
                m: 0,
                mt: 1.5,
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                columnGap: 2,
                rowGap: 0.75,
              }}
            >
              {item.stats.map(([statLabel, value]) => (
                <Fragment key={statLabel}>
                  <Typography component="dt" variant="body2" color="text.secondary">
                    {statLabel}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, textAlign: 'right', fontWeight: 600 }}
                  >
                    {value}
                  </Typography>
                </Fragment>
              ))}
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

/** "Which country costs us the most?": pay per country in local currency, with USD totals. */
export function CountryPaySection() {
  const countries = useGetPayByCountryQuery();
  const isWide = useWideLayout();
  return (
    <SectionCard
      title="Pay by country"
      subtitle="Most expensive first. Median, average and range in local currency."
    >
      {countries.isLoading && <LinearProgress aria-label="Loading pay by country" />}
      {countries.isError && (
        <ErrorState message="Could not load pay by country." onRetry={() => countries.refetch()} />
      )}
      {countries.data && isWide && (
        <TableContainer>
          <Table aria-label="Pay by country" size="small" sx={compactTable}>
            <TableHead>
              <TableRow>
                <TableCell>Country</TableCell>
                <TableCell align="right">Headcount</TableCell>
                <TableCell align="right">Median</TableCell>
                <TableCell align="right">Average</TableCell>
                <TableCell align="right">Range (min – max)</TableCell>
                <TableCell align="right">Average (USD)</TableCell>
                <TableCell align="right">Total cost (USD)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {countries.data.map((row) => (
                <TableRow key={row.countryCode} hover>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                    {row.countryName}
                  </TableCell>
                  <TableCell align="right">{formatCount(row.headcount)}</TableCell>
                  <TableCell align="right" sx={numberCell}>
                    {formatMoney(row.median, row.currency)}
                  </TableCell>
                  <TableCell align="right" sx={numberCell}>
                    {formatMoney(row.average, row.currency)}
                  </TableCell>
                  <TableCell align="right">
                    <MoneyRange min={row.min} max={row.max} currency={row.currency} />
                  </TableCell>
                  <TableCell align="right" sx={numberCell}>
                    {formatMoney(row.averageUsd, 'USD')}
                  </TableCell>
                  <TableCell align="right" sx={{ ...numberCell, fontWeight: 600 }}>
                    {formatCompactUsd(row.totalUsd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {countries.data && !isWide && (
        <StatCardList
          label="Pay by country"
          items={countries.data.map((row) => ({
            key: row.countryCode,
            title: row.countryName,
            subtitle: `${formatCount(row.headcount)} employees · ${row.currency}`,
            stats: [
              ['Median', formatMoney(row.median, row.currency)],
              ['Average', formatMoney(row.average, row.currency)],
              [
                'Range',
                <MoneyRange key="range" min={row.min} max={row.max} currency={row.currency} />,
              ],
              ['Average (USD)', formatMoney(row.averageUsd, 'USD')],
              ['Total cost (USD)', formatCompactUsd(row.totalUsd)],
            ],
          }))}
        />
      )}
    </SectionCard>
  );
}

/** "What do we pay a Software Engineer in India?": pay per job title in one country. */
export function JobTitlePaySection({ countries }: { countries: CountryPay[] }) {
  const [chosen, setChosen] = useState<string>();
  const isWide = useWideLayout();
  const countryCode = chosen ?? countries[0]?.countryCode;
  const jobTitles = useGetPayByJobTitleQuery(countryCode ?? '', { skip: !countryCode });
  const data = jobTitles.data?.countryCode === countryCode ? jobTitles.data : undefined;
  const label = data ? `Pay by job title in ${data.countryName}` : 'Pay by job title';

  return (
    <SectionCard
      title="Pay by job title"
      subtitle="Within one country, in local currency: for benchmarking offers and spotting outliers."
      action={
        <TextField
          select
          size="small"
          label="Country"
          value={countryCode ?? ''}
          onChange={(event) => setChosen(event.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 220 } }}
        >
          {countries.map((country) => (
            <MenuItem key={country.countryCode} value={country.countryCode}>
              {country.countryName}
            </MenuItem>
          ))}
        </TextField>
      }
    >
      {jobTitles.isFetching && !data && <LinearProgress aria-label="Loading pay by job title" />}
      {jobTitles.isError && (
        <ErrorState
          message="Could not load pay by job title."
          onRetry={() => jobTitles.refetch()}
        />
      )}
      {data && data.jobTitles.length === 0 && (
        <EmptyState
          title="No active employees"
          description={`Nobody currently works in ${data.countryName}.`}
        />
      )}
      {data && data.jobTitles.length > 0 && isWide && (
        <TableContainer>
          <Table aria-label={label} size="small" sx={compactTable}>
            <TableHead>
              <TableRow>
                <TableCell>Job title</TableCell>
                <TableCell align="right">Headcount</TableCell>
                <TableCell align="right">Median</TableCell>
                <TableCell align="right">Average</TableCell>
                <TableCell align="right">Range (min – max)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.jobTitles.map((row) => (
                <TableRow key={row.jobTitle} hover>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                    {row.jobTitle}
                  </TableCell>
                  <TableCell align="right">{formatCount(row.headcount)}</TableCell>
                  <TableCell align="right" sx={numberCell}>
                    {formatMoney(row.median, data.currency)}
                  </TableCell>
                  <TableCell align="right" sx={numberCell}>
                    {formatMoney(row.average, data.currency)}
                  </TableCell>
                  <TableCell align="right">
                    <MoneyRange min={row.min} max={row.max} currency={data.currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {data && data.jobTitles.length > 0 && !isWide && (
        <StatCardList
          label={label}
          items={data.jobTitles.map((row) => ({
            key: row.jobTitle,
            title: row.jobTitle,
            stats: [
              ['Headcount', formatCount(row.headcount)],
              ['Median', formatMoney(row.median, data.currency)],
              ['Average', formatMoney(row.average, data.currency)],
              [
                'Range',
                <MoneyRange key="range" min={row.min} max={row.max} currency={data.currency} />,
              ],
            ],
          }))}
        />
      )}
    </SectionCard>
  );
}

/** "Which department costs us the most?": headcount and USD cost per department. */
export function DepartmentSection() {
  const departments = useGetCostByDepartmentQuery();
  const isNarrow = useIsNarrow();
  return (
    <SectionCard
      title="Cost by department"
      subtitle="Total annual salary cost in USD, most expensive first"
    >
      {departments.isLoading && <LinearProgress aria-label="Loading cost by department" />}
      {departments.isError && (
        <ErrorState
          message="Could not load cost by department."
          onRetry={() => departments.refetch()}
        />
      )}
      {departments.data && departments.data.length > 0 && (
        <>
          <Box aria-hidden sx={{ height: Math.max(260, departments.data.length * 36 + 50) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departments.data}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={palette.line} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatCompactUsd}
                  tick={{ fontSize: 12 }}
                  height={48}
                  label={{
                    ...AXIS_TITLE,
                    value: 'Total annual cost (USD)',
                    position: 'insideBottom',
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="department"
                  // Narrower on phones so the bars and the axis title have room.
                  width={isNarrow ? 112 : 160}
                  tick={{ fontSize: isNarrow ? 11 : 12 }}
                  label={{
                    ...AXIS_TITLE,
                    value: 'Department',
                    angle: -90,
                    position: 'insideLeft',
                    style: { ...AXIS_TITLE.style, textAnchor: 'middle' },
                  }}
                />
                <Tooltip formatter={(value) => [formatCompactUsd(Number(value)), 'Total cost']} />
                <Bar dataKey="totalUsd" fill={palette.green} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          {/* Phones: one card per department, so nothing scrolls sideways. */}
          {isNarrow && (
            <Box sx={{ mt: 3 }}>
              <StatCardList
                label="Cost by department"
                items={departments.data.map((row) => ({
                  key: row.department,
                  title: row.department,
                  stats: [
                    ['Headcount', formatCount(row.headcount)],
                    ['Total cost (USD)', formatCompactUsd(row.totalUsd)],
                    ['Average (USD)', formatMoney(row.averageUsd, 'USD')],
                  ],
                }))}
              />
            </Box>
          )}
          {/* Wider screens: below the chart, at full width, so all four columns fit. */}
          {!isNarrow && (
            <TableContainer sx={{ mt: 3 }}>
              <Table aria-label="Cost by department" size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Department</TableCell>
                    <TableCell align="right">Headcount</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Average</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departments.data.map((row) => (
                    <TableRow key={row.department} hover>
                      <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                        {row.department}
                      </TableCell>
                      <TableCell align="right">{formatCount(row.headcount)}</TableCell>
                      <TableCell align="right" sx={numberCell}>
                        {formatCompactUsd(row.totalUsd)}
                      </TableCell>
                      <TableCell align="right" sx={numberCell}>
                        {formatMoney(row.averageUsd, 'USD')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
      {departments.data?.length === 0 && (
        <Typography color="text.secondary">No departments yet.</Typography>
      )}
    </SectionCard>
  );
}
