import { createPrismaClient } from '../../src/db/prisma.js';
import type { Prisma } from '../../src/generated/prisma/client.js';

/** One Prisma client per test file, connected to the test database. */
export const testPrisma = createPrismaClient(process.env.DATABASE_URL!);

/**
 * Empties every table except `component_types`, which the migration fills with the fixed
 * catalogue. TRUNCATE skips row-level triggers, so it also clears the append-only history.
 */
export async function resetDatabase(): Promise<void> {
  await testPrisma.$executeRaw`
    TRUNCATE sessions, users, salary_history, salary_components, employees, countries
    RESTART IDENTITY CASCADE
  `;
}

export async function insertCountry(code = 'IN') {
  return testPrisma.country.create({
    data: { code, name: `Country ${code}`, currency: 'INR', usdPerUnit: '0.012' },
  });
}

export async function insertEmployee(overrides: Partial<Prisma.EmployeeUncheckedCreateInput> = {}) {
  return testPrisma.employee.create({
    data: {
      fullName: 'Asha Verma',
      email: 'asha.verma@acme.example',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      countryCode: 'IN',
      hireDate: new Date('2023-04-01'),
      ...overrides,
    },
  });
}

export async function insertNewHireEntry(employeeId: number) {
  return testPrisma.salaryHistoryEntry.create({
    data: {
      employeeId,
      effectiveDate: new Date('2023-04-01'),
      reason: 'new_hire',
      newComponents: [{ code: 'BASIC', annualAmount: 1_200_000 }],
      newTotal: 1_200_000,
    },
  });
}
