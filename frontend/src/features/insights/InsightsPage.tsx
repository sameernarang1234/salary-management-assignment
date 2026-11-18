import { Box } from '@mui/material';
import {
  useGetInsightsOverviewQuery,
  useGetMetaQuery,
  useGetPayByCountryQuery,
} from '../../api/api';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState } from '../../components/states';
import { formatCompactUsd, formatCount, formatDate, formatMoney } from '../../lib/format';
import {
  CountryPaySection,
  DepartmentSection,
  DistributionSection,
  JobTitlePaySection,
} from './sections';
import { StatCard } from './StatCard';

/** Answers the HR Manager's common pay questions on one screen, for active employees. */
export function InsightsPage() {
  const overview = useGetInsightsOverviewQuery();
  const countries = useGetPayByCountryQuery();
  const meta = useGetMetaQuery();
  const data = overview.data;
  const ratesNote = meta.data
    ? `USD at reference rates as of ${formatDate(meta.data.ratesAsOf)}.`
    : 'USD at reference rates.';

  return (
    <>
      <PageHeader
        title="How ACME pays people"
        description={`Headcount, payroll and pay by country, job title and department, for active employees. ${ratesNote}`}
      />

      {overview.isError && (
        <Box sx={{ mb: 3 }}>
          <ErrorState
            message="Could not load the pay overview."
            onRetry={() => overview.refetch()}
          />
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          mb: 3,
        }}
      >
        <StatCard
          label="Headcount"
          value={data ? formatCount(data.headcount) : '—'}
          hint="Active employees"
          loading={overview.isLoading}
        />
        <StatCard
          label="Total annual payroll"
          value={data ? formatCompactUsd(data.totalPayrollUsd) : '—'}
          hint="Fixed pay, all countries, in USD"
          loading={overview.isLoading}
        />
        <StatCard
          label="Median salary"
          value={data?.medianSalaryUsd != null ? formatMoney(data.medianSalaryUsd, 'USD') : '—'}
          hint="Half earn more, half less (USD)"
          loading={overview.isLoading}
        />
      </Box>

      {data && data.headcount === 0 ? (
        <EmptyState
          title="No active employees yet"
          description="Add employees, or run the seed script, to see how the organisation pays people."
        />
      ) : (
        <Box sx={{ display: 'grid', gap: 3 }}>
          {data && <DistributionSection bands={data.salaryDistribution} />}
          <CountryPaySection />
          {countries.data && countries.data.length > 0 && (
            <JobTitlePaySection countries={countries.data} />
          )}
          <DepartmentSection />
        </Box>
      )}
    </>
  );
}
