import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../src/auth/password.js';
import { REFERENCE_COUNTRIES } from '../../src/referenceData/countries.js';
import { findEmployeeById, listEmployees } from '../../src/repositories/employees.js';
import { listSalaryHistory } from '../../src/repositories/salaryHistory.js';
import { seedDatabase } from '../../src/seed/seedDatabase.js';
import { logIn } from '../../src/services/auth.js';
import { fixedClock } from '../../src/services/clock.js';
import { createEmployee } from '../../src/services/employees.js';
import { testPrisma } from '../helpers/database.js';

const TODAY = '2026-10-31';
const HR_EMAIL = 'hr.manager@acme.example';
const HR_PASSWORD = 'Seed-Test-Password-1';
const context = { db: testPrisma, clock: fixedClock(TODAY) };
let passwordHash: string;

const seed = (count: number) =>
  seedDatabase(testPrisma, {
    count,
    seed: 42,
    today: TODAY,
    hrManager: { email: HR_EMAIL, passwordHash },
  });

beforeAll(async () => {
  passwordHash = await hashPassword(HR_PASSWORD);
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('seedDatabase', () => {
  it('loads the countries, employees, components and history', async () => {
    const result = await seed(300);

    expect(await testPrisma.country.count()).toBe(REFERENCE_COUNTRIES.length);
    expect(await testPrisma.employee.count()).toBe(300);
    expect(result).toEqual({
      employees: 300,
      salaryComponents: await testPrisma.salaryComponent.count(),
      historyEntries: await testPrisma.salaryHistoryEntry.count(),
    });
    expect(result.historyEntries).toBeGreaterThan(300);
  });

  it('stores each employee’s current salary as the last entry of their history', async () => {
    await seed(50);

    for (let id = 1; id <= 50; id += 1) {
      const employee = await findEmployeeById(testPrisma, id);
      const [latest] = await listSalaryHistory(testPrisma, id);
      expect(latest?.newComponents).toEqual(employee?.salaryComponents);
    }
  });

  it('replaces existing data and gives the same result every run', async () => {
    await seed(100);
    const first = await listEmployees(testPrisma, { page: 1, pageSize: 100, includeLeft: true });

    await seed(100);
    const second = await listEmployees(testPrisma, { page: 1, pageSize: 100, includeLeft: true });

    expect(second).toEqual(first);
    expect(await testPrisma.employee.count()).toBe(100);
  });

  it('creates the HR Manager account, who can then sign in', async () => {
    await seed(10);

    await expect(logIn(context, { email: HR_EMAIL, password: HR_PASSWORD })).resolves.toMatchObject(
      { user: { email: HR_EMAIL } },
    );
  });

  it('leaves the id sequences ready for new employees', async () => {
    await seed(20);

    const employee = await createEmployee(context, {
      fullName: 'New Starter',
      email: 'new.starter@acme.example',
      jobTitle: 'Engineer',
      department: 'Engineering',
      countryCode: 'IN',
      hireDate: TODAY,
      components: [{ code: 'BASIC', annualAmount: 1_000_000 }],
    });

    expect(employee.id).toBe(21);
  });
});
