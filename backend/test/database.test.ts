import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../src/db/prisma.js';

describe('database connection', () => {
  const prisma = createPrismaClient(process.env.DATABASE_URL!);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to the PostgreSQL test database', async () => {
    const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;

    expect(rows).toEqual([{ name: 'salary_test' }]);
  });
});
