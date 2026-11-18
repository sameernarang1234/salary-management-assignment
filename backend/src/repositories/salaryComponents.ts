import {
  SALARY_COMPONENT_CODES,
  type SalaryComponent,
  type SalaryComponentCode,
} from '../validators/salaryComponents.js';
import { inTransaction, type Db } from './db.js';

function toComponentCode(code: string): SalaryComponentCode {
  if (!(SALARY_COMPONENT_CODES as readonly string[]).includes(code)) {
    throw new Error(`Unknown salary component in the database: ${code}`);
  }
  return code as SalaryComponentCode;
}

/** Converts database rows to the validators' shape, in catalogue order. */
export function toSalaryComponents(
  rows: readonly { componentCode: string; annualAmount: number }[],
): SalaryComponent[] {
  return rows
    .map((row) => ({ code: toComponentCode(row.componentCode), annualAmount: row.annualAmount }))
    .sort(
      (a, b) => SALARY_COMPONENT_CODES.indexOf(a.code) - SALARY_COMPONENT_CODES.indexOf(b.code),
    );
}

/** An employee's current salary components, in catalogue order (empty if none). */
export async function getSalaryComponents(db: Db, employeeId: number): Promise<SalaryComponent[]> {
  const rows = await db.salaryComponent.findMany({
    where: { employeeId },
    select: { componentCode: true, annualAmount: true },
  });
  return toSalaryComponents(rows);
}

/** Replaces all of an employee's components, atomically. */
export async function replaceSalaryComponents(
  db: Db,
  employeeId: number,
  components: readonly SalaryComponent[],
): Promise<void> {
  await inTransaction(db, async (tx) => {
    await tx.salaryComponent.deleteMany({ where: { employeeId } });
    await tx.salaryComponent.createMany({
      data: components.map(({ code, annualAmount }) => ({
        employeeId,
        componentCode: code,
        annualAmount,
      })),
    });
  });
}
