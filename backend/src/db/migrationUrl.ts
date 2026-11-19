/**
 * The app connects with node-postgres; migrations run through Prisma's own engine. They name
 * the verified-SSL settings differently, so one DATABASE_URL is translated for the migrations:
 *
 *   node-postgres (app)               Prisma migration engine
 *   sslmode=verify-full / verify-ca   sslmode=require + sslaccept=strict (verify the certificate)
 *   sslrootcert=<CA bundle file>      sslcert=<CA bundle file>
 *
 * Used by prisma.config.ts. A URL without these settings (local development) is unchanged.
 */
export function toPrismaCliUrl(databaseUrl: string): string {
  if (!databaseUrl) {
    return databaseUrl;
  }
  const url = new URL(databaseUrl);
  const params = url.searchParams;
  const sslMode = params.get('sslmode');
  const caFile = params.get('sslrootcert');
  if (sslMode !== 'verify-full' && sslMode !== 'verify-ca' && caFile === null) {
    return databaseUrl;
  }

  if (sslMode === 'verify-full' || sslMode === 'verify-ca') {
    params.set('sslmode', 'require');
    params.set('sslaccept', 'strict');
  }
  if (caFile !== null) {
    params.delete('sslrootcert');
    params.set('sslcert', caFile);
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
