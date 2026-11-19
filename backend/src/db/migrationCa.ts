import { readFileSync } from 'node:fs';
import { connect as netConnect } from 'node:net';
import { connect as tlsConnect, type DetailedPeerCertificate } from 'node:tls';

/**
 * Prisma's migration engine trusts only the *first* certificate in its CA file, but the Amazon
 * RDS bundle holds more than a hundred (one root per region and key type). The app's driver
 * reads the whole bundle, so only migrations are affected.
 *
 * So before migrating, we connect once ourselves, verify the server against the whole bundle
 * (hostname included, for verify-full), and hand Prisma just the root that signed it. Prisma
 * then verifies the server again with that root. No region or CA is hard-coded.
 */

/** PostgreSQL asks for TLS with this 8-byte SSLRequest message before the handshake. */
const SSL_REQUEST = Buffer.from([0x00, 0x00, 0x00, 0x08, 0x04, 0xd2, 0x16, 0x2f]);

interface VerifiedSsl {
  host: string;
  port: number;
  caFile: string;
  checkHostname: boolean;
}

/** The verified-SSL settings of a DATABASE_URL, or null when it doesn't use a CA file. */
export function verifiedSslSettings(databaseUrl: string): VerifiedSsl | null {
  if (!databaseUrl) {
    return null;
  }
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  const caFile = url.searchParams.get('sslrootcert');
  if ((sslMode !== 'verify-full' && sslMode !== 'verify-ca') || !caFile) {
    return null;
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    caFile,
    checkHostname: sslMode === 'verify-full',
  };
}

/** The last certificate of a verified chain: the trusted root, which is its own issuer. */
export function rootOf(cert: DetailedPeerCertificate): DetailedPeerCertificate {
  let current = cert;
  while (
    current.issuerCertificate &&
    current.issuerCertificate.fingerprint256 !== current.fingerprint256
  ) {
    current = current.issuerCertificate;
  }
  return current;
}

export function toPem(der: Buffer): string {
  const lines = der.toString('base64').match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

/**
 * Connects to the database server, verifies its certificate against the CA file, and returns
 * the PEM of the root certificate that signed it. Null when the URL doesn't use verified SSL.
 * Rejects if the server can't be reached or its certificate doesn't verify.
 */
export function fetchServerRootCa(databaseUrl: string, timeoutMs = 15_000): Promise<string | null> {
  const ssl = verifiedSslSettings(databaseUrl);
  if (!ssl) {
    return Promise.resolve(null);
  }
  const ca = readFileSync(ssl.caFile);

  return new Promise((resolve, reject) => {
    const socket = netConnect({ host: ssl.host, port: ssl.port });
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(timeoutMs, () =>
      fail(new Error(`Timed out connecting to ${ssl.host}:${ssl.port}`)),
    );
    socket.once('error', fail);
    socket.once('connect', () => socket.write(SSL_REQUEST));
    socket.once('data', (reply) => {
      if (reply[0] !== 0x53 /* 'S' */) {
        fail(new Error('The database server refused SSL'));
        return;
      }
      const tls = tlsConnect({
        socket,
        servername: ssl.host,
        ca,
        rejectUnauthorized: true,
        ...(ssl.checkHostname ? {} : { checkServerIdentity: () => undefined }),
      });
      tls.once('error', fail);
      tls.once('secureConnect', () => {
        const root = rootOf(tls.getPeerCertificate(true));
        tls.destroy();
        resolve(toPem(root.raw));
      });
    });
  });
}
