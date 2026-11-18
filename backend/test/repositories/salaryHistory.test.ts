import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  appendSalaryHistory,
  listSalaryHistory,
  type NewSalaryHistoryEntry,
} from '../../src/repositories/salaryHistory.js';
import {
  insertEmployee,
  insertTestCountries,
  resetDatabase,
  testPrisma,
} from '../helpers/database.js';

let employeeId: number;

const newHire = (): NewSalaryHistoryEntry => ({
  employeeId,
  effectiveDate: '2023-04-01',
  reason: 'new_hire',
  previousComponents: null,
  previousTotal: null,
  newComponents: [{ code: 'BASIC', annualAmount: 1_200_000 }],
  newTotal: 1_200_000,
});

const change = (
  effectiveDate: string,
  previousTotal: number,
  newTotal: number,
): NewSalaryHistoryEntry => ({
  employeeId,
  effectiveDate,
  reason: 'annual_increment',
  previousComponents: [{ code: 'BASIC', annualAmount: previousTotal }],
  previousTotal,
  newComponents: [{ code: 'BASIC', annualAmount: newTotal }],
  newTotal,
});

beforeEach(async () => {
  await resetDatabase();
  await insertTestCountries();
  employeeId = (await insertEmployee()).id;
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('salary history repository', () => {
  it('appends an entry and returns it as a plain object', async () => {
    const entry = await appendSalaryHistory(testPrisma, newHire());

    expect(entry).toEqual({
      id: expect.any(Number),
      ...newHire(),
      recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
  });

  it('lists an employee’s entries newest first by effective date', async () => {
    await appendSalaryHistory(testPrisma, newHire());
    await appendSalaryHistory(testPrisma, change('2025-04-01', 1_320_000, 1_450_000));
    await appendSalaryHistory(testPrisma, change('2024-04-01', 1_200_000, 1_320_000));

    const history = await listSalaryHistory(testPrisma, employeeId);

    expect(history.map((entry) => entry.effectiveDate)).toEqual([
      '2025-04-01',
      '2024-04-01',
      '2023-04-01',
    ]);
  });

  it('lists the most recently recorded entry first when effective dates are equal', async () => {
    await appendSalaryHistory(testPrisma, change('2024-04-01', 1_000, 2_000));
    await appendSalaryHistory(testPrisma, {
      ...change('2024-04-01', 2_000, 1_900),
      reason: 'correction',
    });

    const history = await listSalaryHistory(testPrisma, employeeId);

    expect(history.map((entry) => entry.reason)).toEqual(['correction', 'annual_increment']);
  });

  it('returns the stored component snapshots', async () => {
    await appendSalaryHistory(testPrisma, change('2024-04-01', 1_200_000, 1_320_000));

    const [entry] = await listSalaryHistory(testPrisma, employeeId);

    expect(entry).toMatchObject({
      previousComponents: [{ code: 'BASIC', annualAmount: 1_200_000 }],
      newComponents: [{ code: 'BASIC', annualAmount: 1_320_000 }],
      previousTotal: 1_200_000,
      newTotal: 1_320_000,
    });
  });

  it('only lists the given employee’s entries', async () => {
    const otherId = (await insertEmployee({ email: 'other@acme.example' })).id;
    await appendSalaryHistory(testPrisma, { ...newHire(), employeeId: otherId });

    expect(await listSalaryHistory(testPrisma, employeeId)).toEqual([]);
  });
});
