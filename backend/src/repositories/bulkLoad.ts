import type { SalaryComponent } from '../validators/salaryComponents.js';
import type { Db } from './db.js';
import type { NewSalaryHistoryEntry } from './salaryHistory.js';

/*
 * Bulk operations used only by the seed script. Kept here so that, as everywhere else,
 * all database access lives in repositories.
 *
 * Each batch is sent as ONE bound JSON parameter and expanded by PostgreSQL
 * (jsonb_to_recordset). That is roughly 20 times faster than Prisma's createMany for ~100,000
 * rows, and still injection-safe because the data is never part of the SQL text.
 */

const BATCH_SIZE = 5_000;

function batches<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    result.push(items.slice(start, start + BATCH_SIZE));
  }
  return result;
}

/**
 * Empties every table except the fixed component catalogue, including the append-only history
 * (TRUNCATE skips row triggers). Only the seed script calls this.
 */
export async function deleteAllData(db: Db): Promise<void> {
  await db.$executeRaw`
    TRUNCATE sessions, users, salary_history, salary_components, employees, countries
    RESTART IDENTITY CASCADE
  `;
}

export async function insertCountries(
  db: Db,
  countries: readonly { code: string; name: string; currency: string; usdPerUnit: string }[],
): Promise<void> {
  await db.country.createMany({ data: [...countries] });
}

export interface BulkEmployee {
  id: number;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  hireDate: string;
  leftOn: string | null;
}

export async function insertEmployees(db: Db, employees: readonly BulkEmployee[]): Promise<void> {
  for (const batch of batches(employees)) {
    const rows = JSON.stringify(
      batch.map((employee) => ({
        id: employee.id,
        full_name: employee.fullName,
        email: employee.email,
        job_title: employee.jobTitle,
        department: employee.department,
        country_code: employee.countryCode,
        hire_date: employee.hireDate,
        status: employee.leftOn ? 'left' : 'active',
        left_on: employee.leftOn,
      })),
    );
    await db.$executeRaw`
      INSERT INTO employees
        (id, full_name, email, job_title, department, country_code, hire_date, status, left_on)
      SELECT id, full_name, email, job_title, department, country_code, hire_date,
             status::employee_status, left_on
      FROM jsonb_to_recordset(${rows}::jsonb) AS r(
        id int, full_name text, email citext, job_title text, department text,
        country_code char(2), hire_date date, status text, left_on date
      )
    `;
  }
}

export async function insertSalaryComponents(
  db: Db,
  rows: readonly { employeeId: number; components: readonly SalaryComponent[] }[],
): Promise<void> {
  const flat = rows.flatMap(({ employeeId, components }) =>
    components.map(({ code, annualAmount }) => ({
      employee_id: employeeId,
      component_code: code,
      annual_amount: annualAmount,
    })),
  );
  for (const batch of batches(flat)) {
    await db.$executeRaw`
      INSERT INTO salary_components (employee_id, component_code, annual_amount)
      SELECT employee_id, component_code, annual_amount
      FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS r(
        employee_id int, component_code text, annual_amount int
      )
    `;
  }
}

/** Inserts entries in the given order, so ids follow it (history is listed by date, then id). */
export async function insertSalaryHistory(
  db: Db,
  entries: readonly NewSalaryHistoryEntry[],
): Promise<void> {
  for (const batch of batches(entries)) {
    const rows = JSON.stringify(
      batch.map((entry) => ({
        employee_id: entry.employeeId,
        effective_date: entry.effectiveDate,
        reason: entry.reason,
        previous_components: entry.previousComponents,
        new_components: entry.newComponents,
        previous_total: entry.previousTotal,
        new_total: entry.newTotal,
      })),
    );
    await db.$executeRaw`
      INSERT INTO salary_history
        (employee_id, effective_date, reason, previous_components, new_components,
         previous_total, new_total)
      SELECT (e.value->>'employee_id')::int,
             (e.value->>'effective_date')::date,
             (e.value->>'reason')::salary_change_reason,
             NULLIF(e.value->'previous_components', 'null'::jsonb),
             e.value->'new_components',
             (e.value->>'previous_total')::int,
             (e.value->>'new_total')::int
      FROM jsonb_array_elements(${rows}::jsonb) WITH ORDINALITY AS e(value, position)
      ORDER BY e.position
    `;
  }
}

/** After inserting rows with explicit ids, moves the id sequence past the highest id. */
export async function resetEmployeeIdSequence(db: Db): Promise<void> {
  await db.$executeRaw`
    SELECT setval(
      pg_get_serial_sequence('employees', 'id'),
      COALESCE((SELECT MAX(id) FROM employees), 0) + 1,
      false
    )
  `;
}
