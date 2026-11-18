import { findCountryByCode } from '../repositories/countries.js';
import {
  countBySalaryBand,
  getCostByDepartment as getCostByDepartmentFromDb,
  getPayByCountry as getPayByCountryFromDb,
  getPayByJobTitle as getPayByJobTitleFromDb,
  getPayrollSummary,
  type CountryPay,
  type DepartmentCost,
  type JobTitlePay,
  type PayrollSummary,
} from '../repositories/insights.js';
import type { ServiceContext } from './employees.js';
import { ValidationError } from './errors.js';

export interface SalaryBand {
  label: string;
  minUsd: number;
  /** null for the top band */
  maxUsd: number | null;
}

/** Fixed USD bands for the salary distribution chart. A salary on a boundary goes in the higher band. */
export const SALARY_BANDS_USD: readonly SalaryBand[] = [
  { label: 'Under $10k', minUsd: 0, maxUsd: 10_000 },
  { label: '$10k–$25k', minUsd: 10_000, maxUsd: 25_000 },
  { label: '$25k–$50k', minUsd: 25_000, maxUsd: 50_000 },
  { label: '$50k–$75k', minUsd: 50_000, maxUsd: 75_000 },
  { label: '$75k–$100k', minUsd: 75_000, maxUsd: 100_000 },
  { label: '$100k–$150k', minUsd: 100_000, maxUsd: 150_000 },
  { label: '$150k–$200k', minUsd: 150_000, maxUsd: 200_000 },
  { label: '$200k and above', minUsd: 200_000, maxUsd: null },
];

export interface InsightsOverview extends PayrollSummary {
  salaryDistribution: (SalaryBand & { headcount: number })[];
}

/** Headcount, total payroll, median salary (USD) and the salary distribution, for active employees. */
export async function getInsightsOverview(context: ServiceContext): Promise<InsightsOverview> {
  const thresholds = SALARY_BANDS_USD.slice(1).map((band) => band.minUsd);
  const [summary, bandCounts] = await Promise.all([
    getPayrollSummary(context.db),
    countBySalaryBand(context.db, thresholds),
  ]);
  const headcountByBand = new Map(bandCounts.map(({ band, headcount }) => [band, headcount]));

  return {
    ...summary,
    salaryDistribution: SALARY_BANDS_USD.map((band, index) => ({
      ...band,
      headcount: headcountByBand.get(index) ?? 0,
    })),
  };
}

export function getPayByCountry(context: ServiceContext): Promise<CountryPay[]> {
  return getPayByCountryFromDb(context.db);
}

export interface CountryJobTitlePay {
  countryCode: string;
  countryName: string;
  currency: string;
  jobTitles: JobTitlePay[];
}

/** "What do we pay a Software Engineer in India?": pay per job title within one country. */
export async function getPayByJobTitle(
  context: ServiceContext,
  countryCode: string,
): Promise<CountryJobTitlePay> {
  const country = await findCountryByCode(context.db, countryCode);
  if (!country) {
    throw new ValidationError({ countryCode: 'Unknown country' });
  }
  return {
    countryCode: country.code,
    countryName: country.name,
    currency: country.currency,
    jobTitles: await getPayByJobTitleFromDb(context.db, country.code),
  };
}

export function getCostByDepartment(context: ServiceContext): Promise<DepartmentCost[]> {
  return getCostByDepartmentFromDb(context.db);
}
