import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findEmployeeById } from '../../src/repositories/employees.js';
import { fixedClock } from '../../src/services/clock.js';
import { changeSalary, createEmployee } from '../../src/services/employees.js';
import { insertTestCountries, resetDatabase, testPrisma } from '../helpers/database.js';

// Make the history write fail on demand, to prove each action is one transaction.
const failure = vi.hoisted(() => ({ appendHistory: false }));

vi.mock('../../src/repositories/salaryHistory.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/repositories/salaryHistory.js')>();
  return {
    ...original,
    appendSalaryHistory: (...args: Parameters<typeof original.appendSalaryHistory>) => {
      if (failure.appendHistory) {
        return Promise.reject(new Error('Simulated history failure'));
      }
      return original.appendSalaryHistory(...args);
    },
  };
});

const context = { db: testPrisma, clock: fixedClock('2026-06-30') };

const newEmployee = {
  fullName: 'Asha Verma',
  email: 'asha.verma@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  hireDate: '2023-04-01',
  components: [{ code: 'BASIC', annualAmount: 1_200_000 }],
};

beforeEach(async () => {
  failure.appendHistory = false;
  await resetDatabase();
  await insertTestCountries();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('salary actions are single transactions', () => {
  it('creating an employee saves nothing when the history entry fails', async () => {
    failure.appendHistory = true;

    await expect(createEmployee(context, newEmployee)).rejects.toThrow('Simulated history failure');

    expect(await testPrisma.employee.count()).toBe(0);
    expect(await testPrisma.salaryComponent.count()).toBe(0);
  });

  it('a salary change keeps the old components when the history entry fails', async () => {
    const employee = await createEmployee(context, newEmployee);
    failure.appendHistory = true;

    await expect(
      changeSalary(context, employee.id, {
        components: [{ code: 'BASIC', annualAmount: 1_500_000 }],
        effectiveDate: '2026-04-01',
        reason: 'promotion',
      }),
    ).rejects.toThrow('Simulated history failure');

    expect((await findEmployeeById(testPrisma, employee.id))?.salaryComponents).toEqual([
      { code: 'BASIC', annualAmount: 1_200_000 },
    ]);
    expect(await testPrisma.salaryHistoryEntry.count()).toBe(1);
  });
});
