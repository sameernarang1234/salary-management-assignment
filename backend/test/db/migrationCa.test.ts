import { rootCertificates, type DetailedPeerCertificate } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fetchServerRootCa, rootOf, toPem, verifiedSslSettings } from '../../src/db/migrationCa.js';

const host = 'salary-db.abc.ap-southeast-2.rds.amazonaws.com';
const CA = '/app/certs/rds-global-bundle.pem';

describe('verifiedSslSettings', () => {
  it('reads host, port and CA file, checking the hostname for verify-full', () => {
    expect(
      verifiedSslSettings(
        `postgresql://u:p@${host}:5432/salary?sslmode=verify-full&sslrootcert=${CA}`,
      ),
    ).toEqual({ host, port: 5432, caFile: CA, checkHostname: true });
  });

  it('does not check the hostname for verify-ca, and defaults the port to 5432', () => {
    expect(
      verifiedSslSettings(`postgresql://u:p@${host}/salary?sslmode=verify-ca&sslrootcert=${CA}`),
    ).toEqual({ host, port: 5432, caFile: CA, checkHostname: false });
  });

  it.each([
    ['a local URL', 'postgresql://salary:salary@localhost:5432/salary_dev'],
    ['SSL without a CA file', `postgresql://u:p@${host}:5432/salary?sslmode=require`],
    ['an empty URL', ''],
  ])('returns null for %s', (_, url) => {
    expect(verifiedSslSettings(url)).toBeNull();
  });
});

describe('fetchServerRootCa', () => {
  it('does nothing (no connection) when the URL does not use verified SSL', async () => {
    await expect(
      fetchServerRootCa('postgresql://salary:salary@localhost:1/salary_dev'),
    ).resolves.toBeNull();
  });
});

describe('rootOf', () => {
  const cert = (name: string) =>
    ({ fingerprint256: name, raw: Buffer.from(name) }) as unknown as DetailedPeerCertificate;

  it('walks the chain up to the self-issued root', () => {
    const server = cert('server');
    const intermediate = cert('intermediate');
    const root = cert('root');
    server.issuerCertificate = intermediate;
    intermediate.issuerCertificate = root;
    root.issuerCertificate = root;

    expect(rootOf(server)).toBe(root);
  });

  it('stops at a certificate whose issuer is missing', () => {
    const lone = cert('lone');

    expect(rootOf(lone)).toBe(lone);
  });
});

describe('toPem', () => {
  it('produces a PEM certificate that parses back to the same DER', () => {
    // Any real certificate will do: Node ships Mozilla's root certificates.
    const der = new X509Certificate(rootCertificates[0] ?? '').raw;

    const pem = toPem(der);

    expect(pem.startsWith('-----BEGIN CERTIFICATE-----\n')).toBe(true);
    expect(pem.split('\n').every((line) => line.length <= 64)).toBe(true);
    expect(new X509Certificate(pem).raw.equals(der)).toBe(true);
  });
});
