import type { PrismaClient } from '../generated/prisma/client.js';
import { REFERENCE_COUNTRIES } from '../referenceData/countries.js';
import {
  deleteAllData,
  insertCountries,
  insertEmployees,
  insertSalaryComponents,
  insertSalaryHistory,
  resetEmployeeIdSequence,
} from '../repositories/bulkLoad.js';
import { setHrManagerAccount } from '../repositories/users.js';
import { generateEmployees } from './generate.js';

export interface SeedOptions {
  count: number;
  seed: number;
  /** Reference date for generated dates; fixed so every run produces the same data. */
  today: string;
  hrManager: { email: string; passwordHash: string };
}

/**
 * Replaces all data with a generated organisation, in one transaction: either the whole seed
 * is loaded or the database is left as it was.
 */
export async function seedDatabase(
  db: PrismaClient,
  options: SeedOptions,
): Promise<{ employees: number; salaryComponents: number; historyEntries: number }> {
  const generated = generateEmployees(options);
  const withIds = generated.map((employee, index) => ({ ...employee, id: index + 1 }));

  await db.$transaction(
    async (tx) => {
      await deleteAllData(tx);
      await insertCountries(tx, REFERENCE_COUNTRIES);
      await setHrManagerAccount(tx, options.hrManager.email, options.hrManager.passwordHash);
      await insertEmployees(
        tx,
        withIds.map(({ id, details, leftOn }) => ({ id, ...details, leftOn })),
      );
      await insertSalaryComponents(
        tx,
        withIds.map(({ id, components }) => ({ employeeId: id, components })),
      );
      await insertSalaryHistory(
        tx,
        withIds.flatMap(({ id, history }) =>
          history.map((entry) => ({ ...entry, employeeId: id })),
        ),
      );
      await resetEmployeeIdSequence(tx);
    },
    { timeout: 300_000, maxWait: 10_000 },
  );

  return {
    employees: withIds.length,
    salaryComponents: withIds.reduce((sum, { components }) => sum + components.length, 0),
    historyEntries: withIds.reduce((sum, { history }) => sum + history.length, 0),
  };
}
