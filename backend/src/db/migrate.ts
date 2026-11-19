import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchServerRootCa } from './migrationCa.js';

/**
 * Production start-up step: apply pending migrations with `prisma migrate deploy`.
 * With verified SSL, first picks the one root certificate Prisma's engine needs (see
 * migrationCa.ts) and passes it on through MIGRATION_CA_FILE (read by prisma.config.ts).
 */
const env = { ...process.env };
const rootCa = await fetchServerRootCa(process.env.DATABASE_URL ?? '');
if (rootCa) {
  const caFile = join(tmpdir(), 'migration-root-ca.pem');
  writeFileSync(caFile, rootCa);
  env.MIGRATION_CA_FILE = caFile;
  console.log('Database certificate verified against the CA bundle.');
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env });
process.exit(result.status ?? 1);
