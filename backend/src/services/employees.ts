import { z } from 'zod';
import { inTransaction, type Db } from '../repositories/db.js';
import { findCountryByCode } from '../repositories/countries.js';
import {
  findEmployeeById,
  insertEmployee,
  lockEmployee,
  markEmployeeLeft as markEmployeeLeftInDb,
  updateEmployeeDetails as updateEmployeeDetailsInDb,
  type EmployeeDetails,
  type EmployeeRecord,
} from '../repositories/employees.js';
import { EmailInUseError } from '../repositories/errors.js';
import { replaceSalaryComponents } from '../repositories/salaryComponents.js';
import { appendSalaryHistory, type SalaryHistoryEntry } from '../repositories/salaryHistory.js';
import { isoDateSchema } from '../validators/dates.js';
import { employeeInputSchema } from '../validators/employee.js';
import { salaryChangeSchema } from '../validators/salaryChange.js';
import { salaryComponentsSchema, salaryTotal } from '../validators/salaryComponents.js';
import type { Clock } from './clock.js';
import {
  DuplicateEmailError,
  EmployeeLeftError,
  EmployeeNotFoundError,
  ValidationError,
} from './errors.js';

export interface ServiceContext {
  db: Db;
  clock: Clock;
}

const newEmployeeSchema = employeeInputSchema.extend({ components: salaryComponentsSchema });
const leavingSchema = z.object({ leftOn: isoDateSchema });

function parse<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}

/** Rejects a date after today or before the hire date, reporting it on `field`. */
function checkDate(
  field: string,
  label: string,
  date: string,
  { today, hireDate }: { today: string; hireDate?: string },
): void {
  if (date > today) {
    throw new ValidationError({ [field]: `${label} cannot be in the future` });
  }
  if (hireDate !== undefined && date < hireDate) {
    throw new ValidationError({ [field]: `${label} cannot be before the hire date` });
  }
}

async function checkCountryExists(db: Db, countryCode: string): Promise<void> {
  if (!(await findCountryByCode(db, countryCode))) {
    throw new ValidationError({ countryCode: 'Unknown country' });
  }
}

async function requireEmployee(db: Db, id: number): Promise<EmployeeDetails> {
  const employee = await findEmployeeById(db, id);
  if (!employee) {
    throw new EmployeeNotFoundError(id);
  }
  return employee;
}

async function translateEmailInUse<T>(action: Promise<T>): Promise<T> {
  try {
    return await action;
  } catch (error) {
    if (error instanceof EmailInUseError) {
      throw new DuplicateEmailError(error.email);
    }
    throw error;
  }
}

/**
 * Adds an employee with their first salary. One transaction: the employee, their components
 * and a `new_hire` history entry (effective on the hire date) are saved together or not at all.
 */
export async function createEmployee(
  context: ServiceContext,
  input: unknown,
): Promise<EmployeeDetails> {
  const { components, ...details } = parse(newEmployeeSchema, input);
  checkDate('hireDate', 'Hire date', details.hireDate, { today: context.clock.today() });

  return inTransaction(context.db, async (tx) => {
    await checkCountryExists(tx, details.countryCode);
    const employee = await translateEmailInUse(insertEmployee(tx, details));
    await replaceSalaryComponents(tx, employee.id, components);
    await appendSalaryHistory(tx, {
      employeeId: employee.id,
      effectiveDate: details.hireDate,
      reason: 'new_hire',
      previousComponents: null,
      previousTotal: null,
      newComponents: components,
      newTotal: salaryTotal(components),
    });
    return requireEmployee(tx, employee.id);
  });
}

/** Updates an employee's details. Salary changes go through `changeSalary`. */
export async function updateEmployeeDetails(
  context: ServiceContext,
  id: number,
  input: unknown,
): Promise<EmployeeRecord> {
  const details = parse(employeeInputSchema, input);
  checkDate('hireDate', 'Hire date', details.hireDate, { today: context.clock.today() });

  await checkCountryExists(context.db, details.countryCode);
  const employee = await translateEmailInUse(updateEmployeeDetailsInDb(context.db, id, details));
  if (!employee) {
    throw new EmployeeNotFoundError(id);
  }
  return employee;
}

/**
 * Changes an employee's salary. One transaction: the employee row is locked (so concurrent
 * changes queue up and each sees the true previous salary), the components are replaced and
 * exactly one history entry is appended.
 */
export async function changeSalary(
  context: ServiceContext,
  id: number,
  input: unknown,
): Promise<{ employee: EmployeeDetails; historyEntry: SalaryHistoryEntry }> {
  return inTransaction(context.db, async (tx) => {
    if (!(await lockEmployee(tx, id))) {
      throw new EmployeeNotFoundError(id);
    }
    const current = await requireEmployee(tx, id);
    if (current.status === 'left') {
      throw new EmployeeLeftError(id);
    }
    const change = parse(salaryChangeSchema(current.salaryComponents), input);
    checkDate('effectiveDate', 'Effective date', change.effectiveDate, {
      today: context.clock.today(),
      hireDate: current.hireDate,
    });

    await replaceSalaryComponents(tx, id, change.components);
    const historyEntry = await appendSalaryHistory(tx, {
      employeeId: id,
      effectiveDate: change.effectiveDate,
      reason: change.reason,
      previousComponents: current.salaryComponents,
      previousTotal: current.totalSalary,
      newComponents: change.components,
      newTotal: salaryTotal(change.components),
    });
    return { employee: await requireEmployee(tx, id), historyEntry };
  });
}

/** Marks an employee as left. Their record, salary and history are kept. */
export async function markEmployeeLeft(
  context: ServiceContext,
  id: number,
  input: unknown,
): Promise<EmployeeRecord> {
  const { leftOn } = parse(leavingSchema, input);

  return inTransaction(context.db, async (tx) => {
    if (!(await lockEmployee(tx, id))) {
      throw new EmployeeNotFoundError(id);
    }
    const employee = await requireEmployee(tx, id);
    if (employee.status === 'left') {
      throw new EmployeeLeftError(id);
    }
    checkDate('leftOn', 'Leaving date', leftOn, {
      today: context.clock.today(),
      hireDate: employee.hireDate,
    });
    const updated = await markEmployeeLeftInDb(tx, id, leftOn);
    if (!updated) {
      throw new EmployeeNotFoundError(id);
    }
    return updated;
  });
}
