import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Read lazily so `prisma generate` works without a database (e.g. on a fresh install).
    url: process.env.DATABASE_URL ?? '',
  },
});
