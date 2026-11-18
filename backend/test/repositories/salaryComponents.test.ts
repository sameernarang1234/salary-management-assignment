import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  getSalaryComponents,
  replaceSalaryComponents,
} from '../../src/repositories/salaryComponents.js';
import {
  insertEmployee,
  insertTestCountries,
  resetDatabase,
  testPrisma,
} from '../helpers/database.js';

let employeeId: number;

beforeEach(async () => {
  await resetDatabase();
  await insertTestCountries();
  employeeId = (await insertEmployee()).id;
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('salary components repository', () => {
  it('returns no components for an employee without a salary', async () => {
    expect(await getSalaryComponents(testPrisma, employeeId)).toEqual([]);
  });

  it('returns components in catalogue order, whatever order they were saved in', async () => {
    await replaceSalaryComponents(testPrisma, employeeId, [
      { code: 'SPECIAL', annualAmount: 100_000 },
      { code: 'TRANSPORT', annualAmount: 19_200 },
      { code: 'BASIC', annualAmount: 1_200_000 },
      { code: 'HRA', annualAmount: 480_000 },
    ]);

    expect(await getSalaryComponents(testPrisma, employeeId)).toEqual([
      { code: 'BASIC', annualAmount: 1_200_000 },
      { code: 'HRA', annualAmount: 480_000 },
      { code: 'TRANSPORT', annualAmount: 19_200 },
      { code: 'SPECIAL', annualAmount: 100_000 },
    ]);
  });

  it('replacing components removes the old ones', async () => {
    await replaceSalaryComponents(testPrisma, employeeId, [
      { code: 'BASIC', annualAmount: 1_200_000 },
      { code: 'HRA', annualAmount: 480_000 },
    ]);

    await replaceSalaryComponents(testPrisma, employeeId, [
      { code: 'BASIC', annualAmount: 1_320_000 },
      { code: 'SPECIAL', annualAmount: 50_000 },
    ]);

    expect(await getSalaryComponents(testPrisma, employeeId)).toEqual([
      { code: 'BASIC', annualAmount: 1_320_000 },
      { code: 'SPECIAL', annualAmount: 50_000 },
    ]);
  });

  it('only touches the given employee', async () => {
    const otherId = (await insertEmployee({ email: 'other@acme.example' })).id;
    await replaceSalaryComponents(testPrisma, otherId, [{ code: 'BASIC', annualAmount: 900 }]);

    await replaceSalaryComponents(testPrisma, employeeId, [{ code: 'BASIC', annualAmount: 1_000 }]);

    expect(await getSalaryComponents(testPrisma, otherId)).toEqual([
      { code: 'BASIC', annualAmount: 900 },
    ]);
  });

  it('keeps the old components when the replacement is rejected by the database', async () => {
    await replaceSalaryComponents(testPrisma, employeeId, [{ code: 'BASIC', annualAmount: 1_000 }]);

    await expect(
      replaceSalaryComponents(testPrisma, employeeId, [{ code: 'BASIC', annualAmount: 0 }]),
    ).rejects.toThrow();

    expect(await getSalaryComponents(testPrisma, employeeId)).toEqual([
      { code: 'BASIC', annualAmount: 1_000 },
    ]);
  });
});
