import type { Prisma } from '../generated/prisma/client.js';
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
] as const;

export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

export interface EmployeeListQuery {
  search?: string;
  countryCode?: string;
  department?: string;
  jobTitle?: string;
  sort?: EmployeeSortField;
  order?: 'asc' | 'desc';
  page: number;
  pageSize: number;
  includeLeft?: boolean;
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

function orderBy(
  sort: EmployeeSortField,
  order: 'asc' | 'desc',
): Prisma.EmployeeOrderByWithRelationInput[] {
  const primary: Record<EmployeeSortField, Prisma.EmployeeOrderByWithRelationInput> = {
    fullName: { fullName: order },
    jobTitle: { jobTitle: order },
    department: { department: order },
    country: { country: { name: order } },
    hireDate: { hireDate: order },
  };
  // Ties are always ordered by id, so paging is stable.
  return [primary[sort], { id: 'asc' }];
}

/** The directory: search, filters, sorting and paging. Leavers are excluded unless asked for. */
export async function listEmployees(
  db: Db,
  query: EmployeeListQuery,
): Promise<Page<EmployeeSummary>> {
  const { page, pageSize } = query;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('page and pageSize must be whole numbers of at least 1');
  }
  const search = query.search?.trim();
  const where: Prisma.EmployeeWhereInput = {
    ...(query.includeLeft ? {} : { status: 'active' }),
    ...(query.countryCode !== undefined && { countryCode: query.countryCode }),
    ...(query.department !== undefined && { department: query.department }),
    ...(query.jobTitle !== undefined && { jobTitle: query.jobTitle }),
    ...(search && {
      OR: [
        { fullName: { contains: escapeLike(search), mode: 'insensitive' } },
        { email: { contains: escapeLike(search), mode: 'insensitive' } },
      ],
    }),
  };

  const [rows, total] = await Promise.all([
    db.employee.findMany({
      where,
      select: {
        ...recordSelect,
        country: { select: { currency: true } },
        salaryComponents: { select: { annualAmount: true } },
      },
      orderBy: orderBy(query.sort ?? 'fullName', query.order ?? 'asc'),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.employee.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      ...toRecord(row),
      currency: row.country.currency,
      totalSalary: row.salaryComponents.reduce(
        (total, { annualAmount }) => total + annualAmount,
        0,
      ),
    })),
    total,
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
