import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { fixedClock } from '../../src/services/clock.js';
import { createEmployee, markEmployeeLeft } from '../../src/services/employees.js';
import { ValidationError } from '../../src/services/errors.js';
import {
  SALARY_BANDS_USD,
  getCostByDepartment,
  getInsightsOverview,
  getPayByCountry,
  getPayByJobTitle,
} from '../../src/services/insights.js';
import { insertTestCountries, resetDatabase, testPrisma } from '../helpers/database.js';

const context = { db: testPrisma, clock: fixedClock('2026-06-30') };

let emailCounter = 0;

async function hire(
  fullName: string,
  countryCode: string,
  jobTitle: string,
  department: string,
  basic: number,
) {
  emailCounter += 1;
  return createEmployee(context, {
    fullName,
    email: `person${emailCounter}@acme.example`,
    jobTitle,
    department,
    countryCode,
    hireDate: '2024-01-15',
    components: [{ code: 'BASIC', annualAmount: basic }],
  });
}

/*
 * Rates: IN 0.012, GB 1.27, US 1.
 *
 * | Name   | Country | Job title         | Department  | Local     | USD     |
 * |--------|---------|-------------------|-------------|-----------|---------|
 * | Asha   | IN      | Software Engineer | Engineering | 1,200,000 |  14,400 |
 * | Rahul  | IN      | Software Engineer | Engineering | 1,800,000 |  21,600 |
 * | Priya  | IN      | Product Manager   | Product     | 2,500,000 |  30,000 |
 * | John   | US      | Software Engineer | Engineering |   120,000 | 120,000 |
 * | Carlos | US      | Data Analyst      | Finance     |    80,000 |  80,000 |
 * | Emma   | GB      | Designer          | Design      |    60,000 |  76,200 |
 * | Leaver | IN      | Software Engineer | Engineering | 9,000,000 | (left)  |
 */
async function hireTeam() {
  await hire('Asha', 'IN', 'Software Engineer', 'Engineering', 1_200_000);
  await hire('Rahul', 'IN', 'Software Engineer', 'Engineering', 1_800_000);
  await hire('Priya', 'IN', 'Product Manager', 'Product', 2_500_000);
  await hire('John', 'US', 'Software Engineer', 'Engineering', 120_000);
  await hire('Carlos', 'US', 'Data Analyst', 'Finance', 80_000);
  await hire('Emma', 'GB', 'Designer', 'Design', 60_000);
  const leaver = await hire('Leaver', 'IN', 'Software Engineer', 'Engineering', 9_000_000);
  await markEmployeeLeft(context, leaver.id, { leftOn: '2026-01-31' });
}

beforeEach(async () => {
  await resetDatabase();
  await insertTestCountries();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('getInsightsOverview', () => {
  it('reports headcount, total payroll and median salary in USD, excluding leavers', async () => {
    await hireTeam();

    const overview = await getInsightsOverview(context);

    expect(overview).toMatchObject({
      headcount: 6,
      totalPayrollUsd: 342_200,
      // Sorted USD: 14,400 · 21,600 · 30,000 · 76,200 · 80,000 · 120,000 → (30,000 + 76,200) / 2
      medianSalaryUsd: 53_100,
    });
  });

  it('counts employees in each USD salary band, including empty bands', async () => {
    await hireTeam();

    const { salaryDistribution } = await getInsightsOverview(context);

    expect(salaryDistribution.map((band) => [band.label, band.headcount])).toEqual([
      ['Under $10k', 0],
      ['$10k–$25k', 2],
      ['$25k–$50k', 1],
      ['$50k–$75k', 0],
      ['$75k–$100k', 2],
      ['$100k–$150k', 1],
      ['$150k–$200k', 0],
      ['$200k and above', 0],
    ]);
  });

  it('puts a salary exactly on a band boundary in the higher band', async () => {
    await hire('Boundary', 'US', 'Engineer', 'Engineering', 25_000);

    const { salaryDistribution } = await getInsightsOverview(context);

    expect(salaryDistribution.find((band) => band.headcount === 1)?.label).toBe('$25k–$50k');
  });

  it('describes each band with its USD limits', () => {
    expect(SALARY_BANDS_USD[0]).toEqual({ label: 'Under $10k', minUsd: 0, maxUsd: 10_000 });
    expect(SALARY_BANDS_USD.at(-1)).toEqual({
      label: '$200k and above',
      minUsd: 200_000,
      maxUsd: null,
    });
  });

  it('returns zeros and no median when there are no employees', async () => {
    const overview = await getInsightsOverview(context);

    expect(overview).toMatchObject({ headcount: 0, totalPayrollUsd: 0, medianSalaryUsd: null });
    expect(overview.salaryDistribution.every((band) => band.headcount === 0)).toBe(true);
  });

  it('includes every allowance in the salary, not just Basic', async () => {
    await createEmployee(context, {
      fullName: 'Allowances',
      email: 'allowances@acme.example',
      jobTitle: 'Engineer',
      department: 'Engineering',
      countryCode: 'US',
      hireDate: '2024-01-15',
      components: [
        { code: 'BASIC', annualAmount: 50_000 },
        { code: 'HOUSING', annualAmount: 20_000 },
        { code: 'TRANSPORT', annualAmount: 5_000 },
      ],
    });

    expect((await getInsightsOverview(context)).totalPayrollUsd).toBe(75_000);
  });
});

describe('getPayByCountry', () => {
  it('reports pay in local currency and USD per country, most expensive first', async () => {
    await hireTeam();

    expect(await getPayByCountry(context)).toEqual([
      {
        countryCode: 'US',
        countryName: 'United States',
        currency: 'USD',
        headcount: 2,
        min: 80_000,
        median: 100_000,
        average: 100_000,
        max: 120_000,
        averageUsd: 100_000,
        totalUsd: 200_000,
      },
      {
        countryCode: 'GB',
        countryName: 'United Kingdom',
        currency: 'GBP',
        headcount: 1,
        min: 60_000,
        median: 60_000,
        average: 60_000,
        max: 60_000,
        averageUsd: 76_200,
        totalUsd: 76_200,
      },
      {
        countryCode: 'IN',
        countryName: 'India',
        currency: 'INR',
        headcount: 3,
        min: 1_200_000,
        median: 1_800_000,
        average: 1_833_333, // 5,500,000 / 3 = 1,833,333.33
        max: 2_500_000,
        averageUsd: 22_000,
        totalUsd: 66_000,
      },
    ]);
  });

  it('rounds halves up (100,000.5 → 100,001), not to the nearest even number', async () => {
    await hire('A', 'US', 'Engineer', 'Engineering', 100_000);
    await hire('B', 'US', 'Engineer', 'Engineering', 100_001);

    const [unitedStates] = await getPayByCountry(context);

    expect(unitedStates).toMatchObject({ median: 100_001, average: 100_001 });
  });

  it('leaves out countries with no active employees', async () => {
    await hire('Only', 'US', 'Engineer', 'Engineering', 100_000);

    expect((await getPayByCountry(context)).map((row) => row.countryCode)).toEqual(['US']);
  });
});

describe('getPayByJobTitle', () => {
  it('reports pay per job title within a country, in local currency', async () => {
    await hireTeam();

    expect(await getPayByJobTitle(context, 'IN')).toEqual({
      countryCode: 'IN',
      countryName: 'India',
      currency: 'INR',
      jobTitles: [
        {
          jobTitle: 'Product Manager',
          headcount: 1,
          min: 2_500_000,
          median: 2_500_000,
          average: 2_500_000,
          max: 2_500_000,
        },
        {
          jobTitle: 'Software Engineer',
          headcount: 2,
          min: 1_200_000,
          median: 1_500_000,
          average: 1_500_000,
          max: 1_800_000,
        },
      ],
    });
  });

  it('returns no job titles for a known country without employees', async () => {
    expect((await getPayByJobTitle(context, 'GB')).jobTitles).toEqual([]);
  });

  it('rejects an unknown country', async () => {
    await expect(getPayByJobTitle(context, 'ZZ')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('getCostByDepartment', () => {
  it('reports headcount and USD cost per department, most expensive first', async () => {
    await hireTeam();

    expect(await getCostByDepartment(context)).toEqual([
      { department: 'Engineering', headcount: 3, totalUsd: 156_000, averageUsd: 52_000 },
      { department: 'Finance', headcount: 1, totalUsd: 80_000, averageUsd: 80_000 },
      { department: 'Design', headcount: 1, totalUsd: 76_200, averageUsd: 76_200 },
      { department: 'Product', headcount: 1, totalUsd: 30_000, averageUsd: 30_000 },
    ]);
  });
});
