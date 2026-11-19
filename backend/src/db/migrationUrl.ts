/**
 * The app connects with node-postgres; migrations run through Prisma's own engine. They name
 * the verified-SSL settings differently, so one DATABASE_URL is translated for the migrations:
 *
 *   node-postgres (app)               Prisma migration engine
 *   sslmode=verify-full / verify-ca   sslmode=require + sslaccept=strict (verify the certificate)
 *   sslrootcert=<CA bundle file>      sslcert=<CA bundle file>
 *
 * Prisma's engine trusts only the first certificate in that file, so in production `caFile`
 * (MIGRATION_CA_FILE, written by migrate.ts) replaces the bundle with the one root that signed
 * the server. Used by prisma.config.ts. A URL without these settings (local development) is
 * unchanged.
 */
export function toPrismaCliUrl(databaseUrl: string, caFile?: string): string {
  if (!databaseUrl) {
    return databaseUrl;
  }
  const url = new URL(databaseUrl);
  const params = url.searchParams;
  const sslMode = params.get('sslmode');
  const rootCert = params.get('sslrootcert');
  if (sslMode !== 'verify-full' && sslMode !== 'verify-ca' && rootCert === null) {
    return databaseUrl;
  }

  if (sslMode === 'verify-full' || sslMode === 'verify-ca') {
    params.set('sslmode', 'require');
    params.set('sslaccept', 'strict');
  }
  if (rootCert !== null) {
    params.delete('sslrootcert');
    params.set('sslcert', caFile || rootCert);
  }
  // Keep a stable order: sslmode, sslcert, sslaccept.
  const ordered = new URLSearchParams();
  for (const key of ['sslmode', 'sslcert', 'sslaccept']) {
    const value = params.get(key);
    if (value !== null) {
      ordered.set(key, value);
      params.delete(key);
    }
  }
  for (const [key, value] of params) {
    ordered.append(key, value);
  }
  url.search = ordered.toString();
  return url.toString();
}
