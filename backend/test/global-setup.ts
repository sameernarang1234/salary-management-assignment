import { execSync } from 'node:child_process';
import { config } from 'dotenv';

/** Runs once before all test files: brings the test database schema up to date. */
export default function setup(): void {
  const { parsed } = config({ path: '.env.test', override: true, quiet: true });
  const databaseUrl = parsed?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
    throw new Error('Refusing to migrate: DATABASE_URL in .env.test must end in "_test".');
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
