import { z } from 'zod';
import { hashPassword } from '../auth/password.js';
import { createPrismaClient } from '../db/prisma.js';
import { seedDatabase } from './seedDatabase.js';

/** Fixed reference date, so the generated data is identical on every run. */
const SEED_REFERENCE_DATE = '2026-10-31';

const config = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    HR_MANAGER_EMAIL: z.email('HR_MANAGER_EMAIL must be an email address'),
    HR_MANAGER_PASSWORD: z.string().min(12, 'HR_MANAGER_PASSWORD must be at least 12 characters'),
    SEED: z.coerce.number().int().default(42),
    SEED_EMPLOYEES: z.coerce.number().int().positive().default(10_000),
  })
  .parse(process.env);

const prisma = createPrismaClient(config.DATABASE_URL);
const started = performance.now();

try {
  const result = await seedDatabase(prisma, {
    count: config.SEED_EMPLOYEES,
    seed: config.SEED,
    today: SEED_REFERENCE_DATE,
    hrManager: {
      email: config.HR_MANAGER_EMAIL,
      passwordHash: await hashPassword(config.HR_MANAGER_PASSWORD),
    },
  });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(
    `Seeded ${result.employees} employees, ${result.salaryComponents} salary components and ` +
      `${result.historyEntries} history entries in ${seconds}s. HR Manager: ${config.HR_MANAGER_EMAIL}`,
  );
} finally {
  await prisma.$disconnect();
}
