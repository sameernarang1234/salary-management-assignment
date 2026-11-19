import { describe, expect, it } from 'vitest';
import { toPrismaCliUrl } from '../../src/db/migrationUrl.js';

const CA = '/app/certs/rds-global-bundle.pem';
const base =
  'postgresql://salary_admin:s3cret@salary-db.abc.ap-south-1.rds.amazonaws.com:5432/salary';

const paramsOf = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe('toPrismaCliUrl', () => {
  it('translates the app’s verified-SSL settings into the Prisma migration engine’s names', () => {
    const url = toPrismaCliUrl(`${base}?sslmode=verify-full&sslrootcert=${CA}`);

    expect(paramsOf(url)).toEqual({ sslmode: 'require', sslcert: CA, sslaccept: 'strict' });
  });

  it('keeps the host, port, database and credentials unchanged', () => {
    const url = new URL(toPrismaCliUrl(`${base}?sslmode=verify-full&sslrootcert=${CA}`));

    expect(url.username).toBe('salary_admin');
    expect(url.password).toBe('s3cret');
    expect(url.host).toBe('salary-db.abc.ap-south-1.rds.amazonaws.com:5432');
    expect(url.pathname).toBe('/salary');
  });

  it('treats verify-ca like verify-full: SSL required and the certificate checked', () => {
    expect(paramsOf(toPrismaCliUrl(`${base}?sslmode=verify-ca&sslrootcert=${CA}`))).toMatchObject({
      sslmode: 'require',
      sslaccept: 'strict',
    });
  });

  it('keeps a password containing URL-encoded special characters intact', () => {
    const url = toPrismaCliUrl(
      'postgresql://u:p%40ss%2Fw0rd@host:5432/db?sslmode=verify-full&sslrootcert=/ca.pem',
    );

    expect(decodeURIComponent(new URL(url).password)).toBe('p@ss/w0rd');
  });

  it('leaves a local URL without SSL settings unchanged', () => {
    const local = 'postgresql://salary:salary@localhost:5432/salary_dev';

    expect(toPrismaCliUrl(local)).toBe(local);
  });

  it('returns an empty string for an empty URL (prisma generate needs no database)', () => {
    expect(toPrismaCliUrl('')).toBe('');
  });
});
