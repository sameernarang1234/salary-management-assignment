import {
  Box,
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
} from '@mui/material';
import { useState } from 'react';
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

/** "How do we pay people?": headcount per USD salary band. */
export function DistributionSection({ bands }: { bands: SalaryBand[] }) {
  return (
    <SectionCard
      title="Salary distribution"
      subtitle="Active employees by total annual salary, converted to USD"
    >
      <Box aria-hidden sx={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bands} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.line} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-20}
              dy={8}
              height={50}
            />
            <YAxis tickFormatter={formatCount} tick={{ fontSize: 12 }} width={56} />
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

/** "Which country costs us the most?": pay per country in local currency, with USD totals. */
export function CountryPaySection() {
  const countries = useGetPayByCountryQuery();
  return (
    <SectionCard
      title="Pay by country"
      subtitle="Most expensive first. Min, median, average and max in local currency."
    >
      {countries.isLoading && <LinearProgress aria-label="Loading pay by country" />}
      {countries.isError && (
        <ErrorState message="Could not load pay by country." onRetry={() => countries.refetch()} />
      )}
      {countries.data && (
        <TableContainer>
          <Table aria-label="Pay by country" size="small">
            <TableHead>
              <TableRow>
                <TableCell>Country</TableCell>
                <TableCell align="right">Headcount</TableCell>
                <TableCell align="right">Min</TableCell>
                <TableCell align="right">Median</TableCell>
                <TableCell align="right">Average</TableCell>
                <TableCell align="right">Max</TableCell>
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
                  {[row.min, row.median, row.average, row.max].map((amount, index) => (
                    <TableCell key={index} align="right" sx={numberCell}>
                      {formatMoney(amount, row.currency)}
                    </TableCell>
                  ))}
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
    </SectionCard>
  );
}

/** "What do we pay a Software Engineer in India?": pay per job title in one country. */
export function JobTitlePaySection({ countries }: { countries: CountryPay[] }) {
  const [chosen, setChosen] = useState<string>();
  const countryCode = chosen ?? countries[0]?.countryCode;
  const jobTitles = useGetPayByJobTitleQuery(countryCode ?? '', { skip: !countryCode });
  const data = jobTitles.data?.countryCode === countryCode ? jobTitles.data : undefined;

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
          sx={{ minWidth: 220 }}
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
      {data && data.jobTitles.length > 0 && (
        <TableContainer>
          <Table aria-label={`Pay by job title in ${data.countryName}`} size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job title</TableCell>
                <TableCell align="right">Headcount</TableCell>
                <TableCell align="right">Min</TableCell>
                <TableCell align="right">Median</TableCell>
                <TableCell align="right">Average</TableCell>
                <TableCell align="right">Max</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.jobTitles.map((row) => (
                <TableRow key={row.jobTitle} hover>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                    {row.jobTitle}
                  </TableCell>
                  <TableCell align="right">{formatCount(row.headcount)}</TableCell>
                  {[row.min, row.median, row.average, row.max].map((amount, index) => (
                    <TableCell key={index} align="right" sx={numberCell}>
                      {formatMoney(amount, data.currency)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </SectionCard>
  );
}

/** "Which department costs us the most?": headcount and USD cost per department. */
export function DepartmentSection() {
  const departments = useGetCostByDepartmentQuery();
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
      {departments.data && (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' },
            alignItems: 'center',
          }}
        >
          <Box aria-hidden sx={{ height: Math.max(220, departments.data.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departments.data}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={palette.line} horizontal={false} />
                <XAxis type="number" tickFormatter={formatCompactUsd} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="department" width={130} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [formatCompactUsd(Number(value)), 'Total cost']} />
                <Bar dataKey="totalUsd" fill={palette.green} radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <TableContainer>
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
        </Box>
      )}
      {departments.data?.length === 0 && (
        <Typography color="text.secondary">No departments yet.</Typography>
      )}
    </SectionCard>
  );
}
