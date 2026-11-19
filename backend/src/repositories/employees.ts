import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import type { EmployeeInput } from '../validators/employee.js';
import { salaryTotal, type SalaryComponent } from '../validators/salaryComponents.js';
import { fromIsoDate, toIsoDate, type Db } from './db.js';
import { EmailInUseError, isPrismaError } from './errors.js';
import { toSalaryComponents } from './salaryComponents.js';

export type EmployeeStatus = 'active' | 'left';

/** An employee's own details, without salary. */
export interface EmployeeRecord extends EmployeeInput {
  id: number;
  status: EmployeeStatus;
  leftOn: string | null;
}

/** A row in the directory. */
export interface EmployeeSummary extends EmployeeRecord {
  currency: string;
  totalSalary: number;
}

/** Everything the employee details page needs. */
export interface EmployeeDetails extends EmployeeSummary {
  countryName: string;
  usdPerUnit: string;
  salaryComponents: SalaryComponent[];
}

export const EMPLOYEE_SORT_FIELDS = [
  'fullName',
  'jobTitle',
  'department',
  'country',
  'hireDate',
  'salary',
] as const;

export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

/** Which employees the directory shows: current (default), former, or everyone. */
export const EMPLOYEE_STATUSES = ['active', 'left', 'all'] as const;

export type EmployeeStatusFilter = (typeof EMPLOYEE_STATUSES)[number];

export interface EmployeeListQuery {
  search?: string;
  /** Match any of these countries (empty or missing = all). */
  countryCodes?: readonly string[];
  departments?: readonly string[];
  jobTitles?: readonly string[];
  status?: EmployeeStatusFilter;
  sort?: EmployeeSortField;
  order?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const recordSelect = {
  id: true,
  fullName: true,
  email: true,
  jobTitle: true,
  department: true,
  countryCode: true,
  hireDate: true,
  status: true,
  leftOn: true,
} satisfies Prisma.EmployeeSelect;

type RecordRow = Prisma.EmployeeGetPayload<{ select: typeof recordSelect }>;

function toRecord(row: RecordRow): EmployeeRecord {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    jobTitle: row.jobTitle,
    department: row.department,
    countryCode: row.countryCode,
    hireDate: toIsoDate(row.hireDate),
    status: row.status,
    leftOn: row.leftOn ? toIsoDate(row.leftOn) : null,
  };
}

/** Escapes LIKE wildcards so `%`, `_` and `\` in a search match themselves. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/*
 * The directory is one SQL query so it can sort by the salary total in USD, which Prisma's
 * query builder can't express. Only fixed SQL fragments are chosen from user input (the
 * allow-lists below); every value is a bound parameter.
 */
const SORT_COLUMNS: Record<EmployeeSortField, Prisma.Sql> = {
  fullName: Prisma.sql`e.full_name`,
  jobTitle: Prisma.sql`e.job_title`,
  department: Prisma.sql`e.department`,
  country: Prisma.sql`c.name`,
  hireDate: Prisma.sql`e.hire_date`,
  // Totals in different currencies are compared in USD, so they compare fairly.
  salary: Prisma.sql`(COALESCE(t.total, 0) * c.usd_per_unit)`,
};

const DIRECTIONS = { asc: Prisma.sql`ASC`, desc: Prisma.sql`DESC` } as const;

function whereClause(query: EmployeeListQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  const status = query.status ?? 'active';
  if (status !== 'all') {
    conditions.push(Prisma.sql`e.status = ${status}::employee_status`);
  }
  if (query.countryCodes?.length) {
    conditions.push(Prisma.sql`e.country_code IN (${Prisma.join(query.countryCodes)})`);
  }
  if (query.departments?.length) {
    conditions.push(Prisma.sql`e.department IN (${Prisma.join(query.departments)})`);
  }
  if (query.jobTitles?.length) {
    conditions.push(Prisma.sql`e.job_title IN (${Prisma.join(query.jobTitles)})`);
  }
  const search = query.search?.trim();
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    conditions.push(Prisma.sql`(e.full_name ILIKE ${pattern} OR e.email ILIKE ${pattern})`);
  }
  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

const directoryRowsSchema = z.array(
  z.object({
    id: z.number(),
    full_name: z.string(),
    email: z.string(),
    job_title: z.string(),
    department: z.string(),
    country_code: z.string(),
    hire_date: z.string(),
    status: z.enum(['active', 'left']),
    left_on: z.string().nullable(),
    currency: z.string(),
    total_salary: z.number(),
  }),
);

const countSchema = z.tuple([z.object({ total: z.number() })]);

/** The directory: search, filters (any of several values each), status, sorting and paging. */
export async function listEmployees(
  db: Db,
  query: EmployeeListQuery,
): Promise<Page<EmployeeSummary>> {
  const { page, pageSize } = query;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('page and pageSize must be whole numbers of at least 1');
  }
  const where = whereClause(query);
  const sortColumn = SORT_COLUMNS[query.sort ?? 'fullName'];
  const direction = DIRECTIONS[query.order ?? 'asc'];

  const [rows, count] = await Promise.all([
    db.$queryRaw<unknown[]>`
      SELECT e.id, e.full_name, e.email, e.job_title, e.department, e.country_code,
             to_char(e.hire_date, 'YYYY-MM-DD') AS hire_date,
             e.status::text AS status,
             to_char(e.left_on, 'YYYY-MM-DD') AS left_on,
             c.currency,
             COALESCE(t.total, 0)::float8 AS total_salary
      FROM employees e
      JOIN countries c ON c.code = e.country_code
      LEFT JOIN (
        SELECT employee_id, SUM(annual_amount) AS total
        FROM salary_components
        GROUP BY employee_id
      ) t ON t.employee_id = e.id
      ${where}
      ORDER BY ${sortColumn} ${direction}, e.id ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `,
    db.$queryRaw<unknown[]>`SELECT COUNT(*)::int AS total FROM employees e ${where}`,
  ]);

  return {
    items: directoryRowsSchema.parse(rows).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      jobTitle: row.job_title,
      department: row.department,
      countryCode: row.country_code,
      hireDate: row.hire_date,
      status: row.status,
      leftOn: row.left_on,
      currency: row.currency,
      totalSalary: row.total_salary,
    })),
    total: countSchema.parse(count)[0].total,
    page,
    pageSize,
  };
}

/**
 * Locks an employee's row until the surrounding transaction ends, so concurrent salary changes
 * run one after another. Returns false if there is no such employee. Call inside a transaction.
 */
export async function lockEmployee(db: Db, id: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM employees WHERE id = ${id} FOR UPDATE
  `;
  return rows.length > 0;
}

export async function findEmployeeById(db: Db, id: number): Promise<EmployeeDetails | null> {
  const row = await db.employee.findUnique({
    where: { id },
    select: {
      ...recordSelect,
      country: { select: { name: true, currency: true, usdPerUnit: true } },
      salaryComponents: { select: { componentCode: true, annualAmount: true } },
    },
  });
  if (!row) {
    return null;
  }
  const salaryComponents = toSalaryComponents(row.salaryComponents);

  return {
    ...toRecord(row),
    countryName: row.country.name,
    currency: row.country.currency,
    usdPerUnit: row.country.usdPerUnit.toFixed(),
    salaryComponents,
    totalSalary: salaryTotal(salaryComponents),
  };
}

export async function insertEmployee(db: Db, input: EmployeeInput): Promise<EmployeeRecord> {
  try {
    const row = await db.employee.create({
      data: { ...input, hireDate: fromIsoDate(input.hireDate) },
      select: recordSelect,
    });
    return toRecord(row);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      throw new EmailInUseError(input.email);
    }
    throw error;
  }
}

/** Updates an employee's details; returns null if there is no such employee. */
export async function updateEmployeeDetails(
  db: Db,
  id: number,
  input: EmployeeInput,
): Promise<EmployeeRecord | null> {
  try {
    const row = await db.employee.update({
      where: { id },
      data: { ...input, hireDate: fromIsoDate(input.hireDate) },
      select: recordSelect,
    });
    return toRecord(row);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      throw new EmailInUseError(input.email);
    }
    if (isPrismaError(error, 'P2025')) {
      return null;
    }
    throw error;
  }
}

/** Marks an employee as left on the given date; returns null if there is no such employee. */
export async function markEmployeeLeft(
  db: Db,
  id: number,
  leftOn: string,
): Promise<EmployeeRecord | null> {
  try {
    const row = await db.employee.update({
      where: { id },
      data: { status: 'left', leftOn: fromIsoDate(leftOn) },
      select: recordSelect,
    });
    return toRecord(row);
  } catch (error) {
    if (isPrismaError(error, 'P2025')) {
      return null;
    }
    throw error;
  }
}
