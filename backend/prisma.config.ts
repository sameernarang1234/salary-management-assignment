import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { toPrismaCliUrl } from './src/db/migrationUrl.js';

config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Read lazily so `prisma generate` works without a database (e.g. on a fresh install).
    // Same DATABASE_URL as the app, with SSL settings translated for Prisma's migration engine.
    // MIGRATION_CA_FILE is set by src/db/migrate.ts in production.
    url: toPrismaCliUrl(process.env.DATABASE_URL ?? '', process.env.MIGRATION_CA_FILE),
  },
});
