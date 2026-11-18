import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SALARY_COMPONENT_CATALOGUE } from '../../src/validators/salaryComponents.js';
import {
  insertCountry,
  insertEmployee,
  insertNewHireEntry,
  resetDatabase,
  testPrisma,
} from '../helpers/database.js';

beforeEach(async () => {
  await resetDatabase();
  await insertCountry('IN');
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('component_types', () => {
  it('holds the same catalogue as the validators, with only BASIC required', async () => {
    const rows = await testPrisma.componentType.findMany({ orderBy: { code: 'asc' } });

    expect(
      rows.map(({ code, name, isRequired }) => ({ code, name, required: isRequired })),
    ).toEqual([...SALARY_COMPONENT_CATALOGUE].sort((a, b) => a.code.localeCompare(b.code)));
  });
});

describe('salary_history is append-only', () => {
  it('rejects updating an entry', async () => {
    const employee = await insertEmployee();
    const entry = await insertNewHireEntry(employee.id);

    await expect(
      testPrisma.salaryHistoryEntry.update({ where: { id: entry.id }, data: { newTotal: 1 } }),
    ).rejects.toThrow(/salary_history is append-only/);
  });

  it('rejects deleting an entry', async () => {
    const employee = await insertEmployee();
    const entry = await insertNewHireEntry(employee.id);

    await expect(testPrisma.salaryHistoryEntry.delete({ where: { id: entry.id } })).rejects.toThrow(
      /salary_history is append-only/,
    );
  });

  it('rejects updating entries with raw SQL too', async () => {
    const employee = await insertEmployee();
    await insertNewHireEntry(employee.id);

    await expect(testPrisma.$executeRaw`UPDATE salary_history SET new_total = 1`).rejects.toThrow(
      /salary_history is append-only/,
    );
  });

  it('accepts appending further entries', async () => {
    const employee = await insertEmployee();
    await insertNewHireEntry(employee.id);

    await testPrisma.salaryHistoryEntry.create({
      data: {
        employeeId: employee.id,
        effectiveDate: new Date('2024-04-01'),
        reason: 'annual_increment',
        previousComponents: [{ code: 'BASIC', annualAmount: 1_200_000 }],
        previousTotal: 1_200_000,
        newComponents: [{ code: 'BASIC', annualAmount: 1_320_000 }],
        newTotal: 1_320_000,
      },
    });

    expect(await testPrisma.salaryHistoryEntry.count()).toBe(2);
  });
});

describe('salary_history previous values', () => {
  const base = {
    effectiveDate: new Date('2024-04-01'),
    newComponents: [{ code: 'BASIC', annualAmount: 1_320_000 }],
    newTotal: 1_320_000,
  };

  it('rejects a new_hire entry with previous components', async () => {
    const employee = await insertEmployee();

    await expect(
      testPrisma.salaryHistoryEntry.create({
        data: {
          ...base,
          employeeId: employee.id,
          reason: 'new_hire',
          previousComponents: [{ code: 'BASIC', annualAmount: 1_200_000 }],
          previousTotal: 1_200_000,
        },
      }),
    ).rejects.toThrow(/salary_history_previous_matches_reason/);
  });

  it('rejects a salary change without previous components', async () => {
    const employee = await insertEmployee();

    await expect(
      testPrisma.salaryHistoryEntry.create({
        data: { ...base, employeeId: employee.id, reason: 'promotion' },
      }),
    ).rejects.toThrow(/salary_history_previous_matches_reason/);
  });

  it('rejects a salary change with previous components but no previous total', async () => {
    const employee = await insertEmployee();

    await expect(
      testPrisma.salaryHistoryEntry.create({
        data: {
          ...base,
          employeeId: employee.id,
          reason: 'correction',
          previousComponents: [{ code: 'BASIC', annualAmount: 1_200_000 }],
        },
      }),
    ).rejects.toThrow(/salary_history_previous_matches_reason/);
  });
});

describe('users', () => {
  const account = { email: 'hr.manager@acme.example', passwordHash: 'scrypt$test' };

  it('accepts the single HR Manager account', async () => {
    const user = await testPrisma.user.create({ data: account });

    expect(user.id).toBe(1);
  });

  it('rejects a second account with another id', async () => {
    await testPrisma.user.create({ data: account });

    await expect(
      testPrisma.user.create({ data: { id: 2, email: 'other@acme.example', passwordHash: 'x' } }),
    ).rejects.toThrow(/users_single_account/);
  });

  it('rejects a second account with the default id', async () => {
    await testPrisma.user.create({ data: account });

    await expect(
      testPrisma.user.create({ data: { email: 'other@acme.example', passwordHash: 'x' } }),
    ).rejects.toThrow(/Unique constraint failed/);
  });
});

describe('employees', () => {
  it('rejects an unknown country', async () => {
    await expect(insertEmployee({ countryCode: 'ZZ' })).rejects.toThrow(
      /Foreign key constraint violated/,
    );
  });

  it('rejects the same email in a different case', async () => {
    await insertEmployee({ email: 'asha.verma@acme.example' });

    await expect(insertEmployee({ email: 'Asha.Verma@ACME.example' })).rejects.toThrow(
      /Unique constraint failed/,
    );
  });

  it('rejects left_on when the employee has not left', async () => {
    await expect(insertEmployee({ leftOn: new Date('2025-01-31') })).rejects.toThrow(
      /employees_left_on_matches_status/,
    );
  });

  it('rejects status left without left_on', async () => {
    await expect(insertEmployee({ status: 'left' })).rejects.toThrow(
      /employees_left_on_matches_status/,
    );
  });

  it('accepts a leaver with a left_on date', async () => {
    const employee = await insertEmployee({ status: 'left', leftOn: new Date('2025-01-31') });

    expect(employee.status).toBe('left');
  });

  it('cannot be deleted while salary rows reference it', async () => {
    const employee = await insertEmployee();
    await testPrisma.salaryComponent.create({
      data: { employeeId: employee.id, componentCode: 'BASIC', annualAmount: 1_200_000 },
    });

    await expect(testPrisma.employee.delete({ where: { id: employee.id } })).rejects.toThrow(
      /Foreign key constraint violated/,
    );
    expect(await testPrisma.salaryComponent.count()).toBe(1);
  });

  it('cannot be deleted while history entries reference it', async () => {
    const employee = await insertEmployee();
    await insertNewHireEntry(employee.id);

    await expect(testPrisma.employee.delete({ where: { id: employee.id } })).rejects.toThrow(
      /Foreign key constraint violated/,
    );
  });
});

describe('salary_components', () => {
  const addComponent = async (componentCode: string, annualAmount: number) => {
    const employee = await insertEmployee();
    return testPrisma.salaryComponent.create({
      data: { employeeId: employee.id, componentCode, annualAmount },
    });
  };

  it.each([0, -1, 100_000_001])('rejects an annual amount of %s', async (annualAmount) => {
    await expect(addComponent('BASIC', annualAmount)).rejects.toThrow(
      /salary_components_annual_amount_range/,
    );
  });

  it('accepts an annual amount at the upper limit', async () => {
    const component = await addComponent('BASIC', 100_000_000);

    expect(component.annualAmount).toBe(100_000_000);
  });

  it('rejects an unknown component code', async () => {
    await expect(addComponent('BONUS', 1_000)).rejects.toThrow(/Foreign key constraint violated/);
  });

  it('rejects the same component twice for one employee', async () => {
    const employee = await insertEmployee();
    const data = { employeeId: employee.id, componentCode: 'BASIC', annualAmount: 1_000 };
    await testPrisma.salaryComponent.create({ data });

    await expect(testPrisma.salaryComponent.create({ data })).rejects.toThrow(
      /Unique constraint failed/,
    );
  });
});
