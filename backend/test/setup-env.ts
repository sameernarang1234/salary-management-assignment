import { config } from 'dotenv';

// Tests always use the test database from .env.test, never the development database.
config({ path: '.env.test', override: true, quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
  throw new Error(
    'DATABASE_URL must point to a database whose name ends in "_test". Copy .env.test.example to .env.test.',
  );
}
