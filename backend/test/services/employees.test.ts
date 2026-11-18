import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { findEmployeeById } from '../../src/repositories/employees.js';
import { listSalaryHistory } from '../../src/repositories/salaryHistory.js';
import { fixedClock } from '../../src/services/clock.js';
import {
  changeSalary,
  createEmployee,
  markEmployeeLeft,
  updateEmployeeDetails,
  type ServiceContext,
} from '../../src/services/employees.js';
import {
  DuplicateEmailError,
  EmployeeLeftError,
  EmployeeNotFoundError,
  ValidationError,
} from '../../src/services/errors.js';
import { insertTestCountries, resetDatabase, testPrisma } from '../helpers/database.js';

const context: ServiceContext = { db: testPrisma, clock: fixedClock('2026-06-30') };

const newEmployee = {
  fullName: 'Asha Verma',
  email: 'asha.verma@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  hireDate: '2023-04-01',
  components: [
    { code: 'BASIC', annualAmount: 1_200_000 },
    { code: 'HRA', annualAmount: 480_000 },
  ],
};

const raise = {
  components: [
    { code: 'BASIC', annualAmount: 1_320_000 },
    { code: 'HRA', annualAmount: 480_000 },
  ],
  effectiveDate: '2026-04-01',
  reason: 'annual_increment',
};

/** Runs `action` and returns the error it throws, failing the test if it doesn't throw. */
async function errorFrom(action: Promise<unknown>): Promise<unknown> {
  try {
    await action;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw');
}

async function fieldErrorsFrom(action: Promise<unknown>) {
  const error = await errorFrom(action);
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).fields;
}

beforeEach(async () => {
  await resetDatabase();
  await insertTestCountries();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('createEmployee', () => {
  it('saves the employee with their salary components', async () => {
    const employee = await createEmployee(context, newEmployee);

    expect(employee).toMatchObject({
      fullName: 'Asha Verma',
      currency: 'INR',
      status: 'active',
      salaryComponents: newEmployee.components,
      totalSalary: 1_680_000,
    });
    expect(await findEmployeeById(testPrisma, employee.id)).toEqual(employee);
  });

  it('writes exactly one new_hire history entry, effective on the hire date', async () => {
    const employee = await createEmployee(context, newEmployee);

    const history = await listSalaryHistory(testPrisma, employee.id);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      reason: 'new_hire',
      effectiveDate: '2023-04-01',
      previousComponents: null,
      previousTotal: null,
      newComponents: newEmployee.components,
      newTotal: 1_680_000,
    });
  });

  it('rejects invalid details and components with errors per field', async () => {
    const fields = await fieldErrorsFrom(
      createEmployee(context, {
        ...newEmployee,
        email: 'not-an-email',
        components: [{ code: 'HRA', annualAmount: 1_000 }],
      }),
    );

    expect(fields).toEqual({
      email: 'Enter a valid email address',
      components: 'Basic is required',
    });
    expect(await testPrisma.employee.count()).toBe(0);
  });

  it('rejects an unknown country', async () => {
    const fields = await fieldErrorsFrom(
      createEmployee(context, { ...newEmployee, countryCode: 'ZZ' }),
    );

    expect(fields).toEqual({ countryCode: 'Unknown country' });
  });

  it('rejects a hire date in the future', async () => {
    const fields = await fieldErrorsFrom(
      createEmployee(context, { ...newEmployee, hireDate: '2026-07-01' }),
    );

    expect(fields).toEqual({ hireDate: 'Hire date cannot be in the future' });
  });

  it('accepts a hire date of today', async () => {
    await expect(
      createEmployee(context, { ...newEmployee, hireDate: '2026-06-30' }),
    ).resolves.toMatchObject({ hireDate: '2026-06-30' });
  });

  it('rejects a duplicate email in any case and saves nothing', async () => {
    await createEmployee(context, newEmployee);

    const error = await errorFrom(
      createEmployee(context, { ...newEmployee, email: 'ASHA.VERMA@acme.example' }),
    );

    expect(error).toBeInstanceOf(DuplicateEmailError);
    expect(await testPrisma.employee.count()).toBe(1);
    expect(await testPrisma.salaryHistoryEntry.count()).toBe(1);
  });
});

describe('updateEmployeeDetails', () => {
  it('updates the details without touching the salary', async () => {
    const employee = await createEmployee(context, newEmployee);

    const updated = await updateEmployeeDetails(context, employee.id, {
      ...newEmployee,
      jobTitle: 'Senior Software Engineer',
    });

    expect(updated.jobTitle).toBe('Senior Software Engineer');
    expect((await findEmployeeById(testPrisma, employee.id))?.totalSalary).toBe(1_680_000);
    expect(await listSalaryHistory(testPrisma, employee.id)).toHaveLength(1);
  });

  it('rejects an unknown employee', async () => {
    expect(await errorFrom(updateEmployeeDetails(context, 999_999, newEmployee))).toBeInstanceOf(
      EmployeeNotFoundError,
    );
  });

  it('rejects an unknown country', async () => {
    const employee = await createEmployee(context, newEmployee);

    const fields = await fieldErrorsFrom(
      updateEmployeeDetails(context, employee.id, { ...newEmployee, countryCode: 'ZZ' }),
    );

    expect(fields).toEqual({ countryCode: 'Unknown country' });
  });

  it('rejects another employee’s email', async () => {
    await createEmployee(context, newEmployee);
    const other = await createEmployee(context, { ...newEmployee, email: 'other@acme.example' });

    const error = await errorFrom(updateEmployeeDetails(context, other.id, newEmployee));

    expect(error).toBeInstanceOf(DuplicateEmailError);
  });

  it('rejects invalid details', async () => {
    const employee = await createEmployee(context, newEmployee);

    const fields = await fieldErrorsFrom(
      updateEmployeeDetails(context, employee.id, { ...newEmployee, fullName: ' ' }),
    );

    expect(fields).toEqual({ fullName: 'Required' });
  });
});

describe('changeSalary', () => {
  it('replaces the components and writes exactly one history entry', async () => {
    const employee = await createEmployee(context, newEmployee);

    const result = await changeSalary(context, employee.id, raise);

    expect(result.employee).toMatchObject({
      salaryComponents: raise.components,
      totalSalary: 1_800_000,
    });
    const history = await listSalaryHistory(testPrisma, employee.id);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(result.historyEntry);
    expect(result.historyEntry).toMatchObject({
      reason: 'annual_increment',
      effectiveDate: '2026-04-01',
      previousComponents: newEmployee.components,
      previousTotal: 1_680_000,
      newComponents: raise.components,
      newTotal: 1_800_000,
    });
  });

  it('rejects an unchanged salary and writes nothing', async () => {
    const employee = await createEmployee(context, newEmployee);

    const fields = await fieldErrorsFrom(
      changeSalary(context, employee.id, { ...raise, components: newEmployee.components }),
    );

    expect(fields).toEqual({ components: 'The new salary is the same as the current salary' });
    expect(await listSalaryHistory(testPrisma, employee.id)).toHaveLength(1);
  });

  it('rejects an unknown employee', async () => {
    expect(await errorFrom(changeSalary(context, 999_999, raise))).toBeInstanceOf(
      EmployeeNotFoundError,
    );
  });

  it('rejects an employee who has left', async () => {
    const employee = await createEmployee(context, newEmployee);
    await markEmployeeLeft(context, employee.id, { leftOn: '2026-05-31' });

    expect(await errorFrom(changeSalary(context, employee.id, raise))).toBeInstanceOf(
      EmployeeLeftError,
    );
  });

  it('rejects an effective date before the hire date', async () => {
    const employee = await createEmployee(context, newEmployee);

    const fields = await fieldErrorsFrom(
      changeSalary(context, employee.id, { ...raise, effectiveDate: '2023-03-31' }),
    );

    expect(fields).toEqual({ effectiveDate: 'Effective date cannot be before the hire date' });
  });

  it('rejects an effective date in the future', async () => {
    const employee = await createEmployee(context, newEmployee);

    const fields = await fieldErrorsFrom(
      changeSalary(context, employee.id, { ...raise, effectiveDate: '2026-07-01' }),
    );

    expect(fields).toEqual({ effectiveDate: 'Effective date cannot be in the future' });
  });

  it('rejects an invalid change with errors per field', async () => {
    const employee = await createEmployee(context, newEmployee);

    const fields = await fieldErrorsFrom(
      changeSalary(context, employee.id, { ...raise, reason: 'bonus', effectiveDate: 'soon' }),
    );

    expect(fields).toEqual({
      reason: 'Choose a valid reason',
      effectiveDate: 'Enter a valid date (YYYY-MM-DD)',
    });
  });

  it('records two simultaneous changes in order, each with the correct previous salary', async () => {
    const employee = await createEmployee(context, newEmployee);
    const toBasic = (annualAmount: number) => ({
      ...raise,
      components: [{ code: 'BASIC', annualAmount }],
    });

    await Promise.all([
      changeSalary(context, employee.id, toBasic(1_300_000)),
      changeSalary(context, employee.id, toBasic(1_400_000)),
    ]);

    const history = (await listSalaryHistory(testPrisma, employee.id)).sort((a, b) => a.id - b.id);
    expect(history).toHaveLength(3);
    const [hire, first, second] = history;
    expect(first?.previousTotal).toBe(hire?.newTotal);
    expect(second?.previousTotal).toBe(first?.newTotal);
    expect((await findEmployeeById(testPrisma, employee.id))?.totalSalary).toBe(second?.newTotal);
  });
});

describe('markEmployeeLeft', () => {
  it('marks the employee as left on the given date', async () => {
    const employee = await createEmployee(context, newEmployee);

    expect(await markEmployeeLeft(context, employee.id, { leftOn: '2026-06-30' })).toMatchObject({
      status: 'left',
      leftOn: '2026-06-30',
    });
  });

  it('keeps salary and history when an employee leaves', async () => {
    const employee = await createEmployee(context, newEmployee);

    await markEmployeeLeft(context, employee.id, { leftOn: '2026-05-31' });

    expect((await findEmployeeById(testPrisma, employee.id))?.totalSalary).toBe(1_680_000);
    expect(await listSalaryHistory(testPrisma, employee.id)).toHaveLength(1);
  });

  it('rejects an employee who has already left', async () => {
    const employee = await createEmployee(context, newEmployee);
    await markEmployeeLeft(context, employee.id, { leftOn: '2026-05-31' });

    expect(
      await errorFrom(markEmployeeLeft(context, employee.id, { leftOn: '2026-06-30' })),
    ).toBeInstanceOf(EmployeeLeftError);
  });

  it('rejects an unknown employee', async () => {
    expect(
      await errorFrom(markEmployeeLeft(context, 999_999, { leftOn: '2026-06-30' })),
    ).toBeInstanceOf(EmployeeNotFoundError);
  });

  it.each([
    ['2023-03-31', 'Leaving date cannot be before the hire date'],
    ['2026-07-01', 'Leaving date cannot be in the future'],
    ['2026-02-30', 'Enter a valid date (YYYY-MM-DD)'],
  ])('rejects the leaving date %s', async (leftOn, message) => {
    const employee = await createEmployee(context, newEmployee);

    expect(await fieldErrorsFrom(markEmployeeLeft(context, employee.id, { leftOn }))).toEqual({
      leftOn: message,
    });
  });
});
