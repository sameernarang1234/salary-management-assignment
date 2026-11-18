import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import type { Db } from './db.js';

/*
 * All aggregation runs in PostgreSQL, over active employees only.
 *
 * Rounding: amounts are whole numbers. Medians and averages are rounded half up (as `numeric`;
 * ROUND on double precision would round half to even), matching `toUsd` in the validators.
 * Results are cast to float8, which is exact for whole numbers below 2^53.
 */

/** One row per active employee: their country, department, job title and total salary. */
const activeTotals = Prisma.sql`
  SELECT e.id, e.country_code, e.department, e.job_title,
         SUM(sc.annual_amount)::numeric AS total,
         SUM(sc.annual_amount)::numeric * c.usd_per_unit AS total_usd
  FROM employees e
  JOIN salary_components sc ON sc.employee_id = e.id
  JOIN countries c ON c.code = e.country_code
  WHERE e.status = 'active'
  GROUP BY e.id, c.usd_per_unit
`;

const summarySchema = z.object({
  headcount: z.number(),
  total_payroll_usd: z.number(),
  median_salary_usd: z.number().nullable(),
});

export interface PayrollSummary {
  headcount: number;
  totalPayrollUsd: number;
  medianSalaryUsd: number | null;
}

export async function getPayrollSummary(db: Db): Promise<PayrollSummary> {
  const rows = await db.$queryRaw<unknown[]>`
    WITH totals AS (${activeTotals})
    SELECT COUNT(*)::int AS headcount,
           COALESCE(ROUND(SUM(total_usd)), 0)::float8 AS total_payroll_usd,
           ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY total_usd)::numeric)::float8
             AS median_salary_usd
    FROM totals
  `;
  const row = summarySchema.parse(rows[0]);
  return {
    headcount: row.headcount,
    totalPayrollUsd: row.total_payroll_usd,
    medianSalaryUsd: row.median_salary_usd,
  };
}

const bandCountSchema = z.array(z.object({ band: z.number(), headcount: z.number() }));

/**
 * Headcount per USD salary band. `thresholds` are the band lower limits after the first
 * (ascending); band 0 is below thresholds[0], band i covers [thresholds[i-1], thresholds[i]).
 * Only bands with employees are returned.
 */
export async function countBySalaryBand(
  db: Db,
  thresholds: readonly number[],
): Promise<{ band: number; headcount: number }[]> {
  const rows = await db.$queryRaw<unknown[]>`
    WITH totals AS (${activeTotals})
    SELECT width_bucket(ROUND(total_usd), ${thresholds}::numeric[])::int AS band,
           COUNT(*)::int AS headcount
    FROM totals
    GROUP BY band
  `;
  return bandCountSchema.parse(rows);
}

const payStatsShape = {
  headcount: z.number(),
  min: z.number(),
  median: z.number(),
  average: z.number(),
  max: z.number(),
};

const payStatsColumns = Prisma.sql`
  COUNT(*)::int AS headcount,
  MIN(t.total)::float8 AS min,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY t.total)::numeric)::float8 AS median,
  ROUND(AVG(t.total))::float8 AS average,
  MAX(t.total)::float8 AS max
`;

export interface PayStats {
  headcount: number;
  min: number;
  median: number;
  average: number;
  max: number;
}

export interface CountryPay extends PayStats {
  countryCode: string;
  countryName: string;
  currency: string;
  averageUsd: number;
  totalUsd: number;
}

const countryPaySchema = z.array(
  z.object({
    country_code: z.string(),
    country_name: z.string(),
    currency: z.string(),
    ...payStatsShape,
    average_usd: z.number(),
    total_usd: z.number(),
  }),
);

/** Pay per country in local currency, plus USD average and total; most expensive first. */
export async function getPayByCountry(db: Db): Promise<CountryPay[]> {
  const rows = await db.$queryRaw<unknown[]>`
    WITH totals AS (${activeTotals})
    SELECT c.code AS country_code, c.name AS country_name, c.currency,
           ${payStatsColumns},
           ROUND(AVG(t.total_usd))::float8 AS average_usd,
           ROUND(SUM(t.total_usd))::float8 AS total_usd
    FROM totals t
    JOIN countries c ON c.code = t.country_code
    GROUP BY c.code
    ORDER BY total_usd DESC, c.name
  `;
  return countryPaySchema.parse(rows).map((row) => ({
    countryCode: row.country_code,
    countryName: row.country_name,
    currency: row.currency,
    headcount: row.headcount,
    min: row.min,
    median: row.median,
    average: row.average,
    max: row.max,
    averageUsd: row.average_usd,
    totalUsd: row.total_usd,
  }));
}

export interface JobTitlePay extends PayStats {
  jobTitle: string;
}

const jobTitlePaySchema = z.array(z.object({ job_title: z.string(), ...payStatsShape }));

/** Pay per job title within one country, in local currency, by job title. */
export async function getPayByJobTitle(db: Db, countryCode: string): Promise<JobTitlePay[]> {
  const rows = await db.$queryRaw<unknown[]>`
    WITH totals AS (${activeTotals})
    SELECT t.job_title, ${payStatsColumns}
    FROM totals t
    WHERE t.country_code = ${countryCode}
    GROUP BY t.job_title
    ORDER BY t.job_title
  `;
  return jobTitlePaySchema.parse(rows).map(({ job_title, ...stats }) => ({
    jobTitle: job_title,
    ...stats,
  }));
}

export interface DepartmentCost {
  department: string;
  headcount: number;
  totalUsd: number;
  averageUsd: number;
}

const departmentCostSchema = z.array(
  z.object({
    department: z.string(),
    headcount: z.number(),
    total_usd: z.number(),
    average_usd: z.number(),
  }),
);

/** Headcount and USD cost per department; most expensive first. */
export async function getCostByDepartment(db: Db): Promise<DepartmentCost[]> {
  const rows = await db.$queryRaw<unknown[]>`
    WITH totals AS (${activeTotals})
    SELECT department,
           COUNT(*)::int AS headcount,
           ROUND(SUM(total_usd))::float8 AS total_usd,
           ROUND(AVG(total_usd))::float8 AS average_usd
    FROM totals
    GROUP BY department
    ORDER BY total_usd DESC, department
  `;
  return departmentCostSchema.parse(rows).map((row) => ({
    department: row.department,
    headcount: row.headcount,
    totalUsd: row.total_usd,
    averageUsd: row.average_usd,
  }));
}
