import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type {
  CountryJobTitlePay,
  CountryPay,
  DepartmentCost,
  InsightsOverview,
} from '../../api/types';
import { renderWithProviders } from '../../test/render';
import { server } from '../../test/server';
import { InsightsPage } from './InsightsPage';

const overview: InsightsOverview = {
  headcount: 9_547,
  totalPayrollUsd: 761_300_000,
  medianSalaryUsd: 53_100,
  salaryDistribution: [
    { label: 'Under $10k', minUsd: 0, maxUsd: 10_000, headcount: 120 },
    { label: '$10k–$25k', minUsd: 10_000, maxUsd: 25_000, headcount: 2_400 },
    { label: '$25k–$50k', minUsd: 25_000, maxUsd: 50_000, headcount: 1_900 },
    { label: '$50k–$75k', minUsd: 50_000, maxUsd: 75_000, headcount: 2_100 },
    { label: '$75k–$100k', minUsd: 75_000, maxUsd: 100_000, headcount: 1_500 },
    { label: '$100k–$150k', minUsd: 100_000, maxUsd: 150_000, headcount: 1_200 },
    { label: '$150k–$200k', minUsd: 150_000, maxUsd: 200_000, headcount: 250 },
    { label: '$200k and above', minUsd: 200_000, maxUsd: null, headcount: 77 },
  ],
};

const countries: CountryPay[] = [
  {
    countryCode: 'US',
    countryName: 'United States',
    currency: 'USD',
    headcount: 1_700,
    min: 42_000,
    median: 110_000,
    average: 112_500,
    max: 240_000,
    averageUsd: 112_500,
    totalUsd: 191_250_000,
  },
  {
    countryCode: 'IN',
    countryName: 'India',
    currency: 'INR',
    headcount: 3_379,
    min: 900_000,
    median: 2_400_000,
    average: 2_550_000,
    max: 6_000_000,
    averageUsd: 30_600,
    totalUsd: 103_397_400,
  },
];

const jobTitlesByCountry: Record<string, CountryJobTitlePay> = {
  US: {
    countryCode: 'US',
    countryName: 'United States',
    currency: 'USD',
    jobTitles: [
      {
        jobTitle: 'Software Engineer',
        headcount: 300,
        min: 80_000,
        median: 110_000,
        average: 111_000,
        max: 150_000,
      },
    ],
  },
  IN: {
    countryCode: 'IN',
    countryName: 'India',
    currency: 'INR',
    jobTitles: [
      {
        jobTitle: 'Software Engineer',
        headcount: 600,
        min: 1_500_000,
        median: 2_600_000,
        average: 2_700_000,
        max: 4_200_000,
      },
    ],
  },
};

const departments: DepartmentCost[] = [
  { department: 'Engineering', headcount: 3_800, totalUsd: 380_000_000, averageUsd: 100_000 },
  { department: 'Sales', headcount: 1_050, totalUsd: 84_000_000, averageUsd: 80_000 },
];

function serveInsights(data: { overview?: InsightsOverview } = {}) {
  const jobTitleRequests: string[] = [];
  server.use(
    http.get('/api/insights/overview', () => HttpResponse.json(data.overview ?? overview)),
    http.get('/api/insights/countries', () => HttpResponse.json({ items: countries })),
    http.get('/api/insights/countries/:code/job-titles', ({ params }) => {
      const code = String(params.code);
      jobTitleRequests.push(code);
      return HttpResponse.json(jobTitlesByCountry[code]);
    }),
    http.get('/api/insights/departments', () => HttpResponse.json({ items: departments })),
  );
  return { jobTitleRequests };
}

describe('<InsightsPage />', () => {
  it('shows headcount, total payroll and median salary in USD', async () => {
    serveInsights();
    renderWithProviders(<InsightsPage />);

    const headcount = await screen.findByRole('group', { name: 'Headcount' });
    expect(headcount).toHaveTextContent('9,547');
    expect(screen.getByRole('group', { name: 'Total annual payroll' })).toHaveTextContent(
      '$761.3M',
    );
    expect(screen.getByRole('group', { name: 'Median salary' })).toHaveTextContent('$53,100');
    expect(screen.getByText(/USD at reference rates as of 1 Jan 2026/)).toBeInTheDocument();
  });

  it('shows the salary distribution, with the data in a table for screen readers', async () => {
    serveInsights();
    renderWithProviders(<InsightsPage />);

    const table = await screen.findByRole('table', { name: 'Salary distribution' });
    expect(within(table).getAllByRole('row')).toHaveLength(9); // header + 8 bands
    expect(within(table).getByRole('row', { name: '$10k–$25k 2,400' })).toBeInTheDocument();
  });

  it('compares pay by country, most expensive first, in local currency and USD', async () => {
    serveInsights();
    renderWithProviders(<InsightsPage />);

    const table = await screen.findByRole('table', { name: 'Pay by country' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('United States');
    expect(rows[0]).toHaveTextContent('$191.3M');
    expect(rows[1]).toHaveTextContent('India');
    expect(rows[1]).toHaveTextContent('₹24,00,000'); // median, local
    expect(rows[1]).toHaveTextContent('$30,600'); // average, USD
  });

  it('answers "what do we pay a Software Engineer in a country?", for the chosen country', async () => {
    const { jobTitleRequests } = serveInsights();
    const { user } = renderWithProviders(<InsightsPage />);

    // Starts with the most expensive country.
    let table = await screen.findByRole('table', { name: 'Pay by job title in United States' });
    expect(
      within(table).getByRole('row', { name: /Software Engineer 300 \$80,000 \$110,000/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'India' }));

    table = await screen.findByRole('table', { name: 'Pay by job title in India' });
    expect(within(table).getByText('₹26,00,000')).toBeInTheDocument();
    expect(jobTitleRequests).toEqual(['US', 'IN']);
  });

  it('shows headcount and cost by department', async () => {
    serveInsights();
    renderWithProviders(<InsightsPage />);

    const table = await screen.findByRole('table', { name: 'Cost by department' });
    expect(
      within(table).getByRole('row', { name: 'Engineering 3,800 $380M $100,000' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('row', { name: 'Sales 1,050 $84M $80,000' }),
    ).toBeInTheDocument();
  });

  it('explains that there is nothing to show yet when there are no active employees', async () => {
    serveInsights({
      overview: {
        headcount: 0,
        totalPayrollUsd: 0,
        medianSalaryUsd: null,
        salaryDistribution: overview.salaryDistribution.map((band) => ({ ...band, headcount: 0 })),
      },
    });
    renderWithProviders(<InsightsPage />);

    expect(await screen.findByText('No active employees yet')).toBeInTheDocument();
  });

  it('shows an error with a retry button when the insights fail to load', async () => {
    let fail = true;
    serveInsights();
    server.use(
      http.get('/api/insights/overview', () =>
        fail
          ? HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 })
          : HttpResponse.json(overview),
      ),
    );
    const { user } = renderWithProviders(<InsightsPage />);

    expect(await screen.findByText('Could not load the pay overview.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Headcount' })).toHaveTextContent('9,547'),
    );
  });
});
