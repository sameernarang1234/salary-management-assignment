import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../../src/auth/password.js';
import { setHrManagerAccount } from '../../src/repositories/users.js';
import { SESSION_LIFETIME_MS, authenticate, logIn, logOut } from '../../src/services/auth.js';
import { fixedClock } from '../../src/services/clock.js';
import { InvalidCredentialsError, ValidationError } from '../../src/services/errors.js';
import { resetDatabase, testPrisma } from '../helpers/database.js';

const EMAIL = 'hr.manager@acme.example';
const PASSWORD = 'Correct-Horse-42';
const loginTime = '2026-06-30T09:00:00.000Z';
const at = (iso: string) => ({ db: testPrisma, clock: fixedClock(iso) });
const later = (ms: number) => new Date(Date.parse(loginTime) + ms).toISOString();

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(async () => {
  await resetDatabase();
  await setHrManagerAccount(testPrisma, EMAIL, passwordHash);
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('logIn', () => {
  it('returns a session token that expires after the session lifetime', async () => {
    const session = await logIn(at(loginTime), { email: EMAIL, password: PASSWORD });

    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.expiresAt).toBe(later(SESSION_LIFETIME_MS));
    expect(session.user).toEqual({ email: EMAIL });
  });

  it('stores only a SHA-256 hash of the token', async () => {
    const { token } = await logIn(at(loginTime), { email: EMAIL, password: PASSWORD });

    const [stored] = await testPrisma.session.findMany();
    expect(stored?.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(stored?.tokenHash).not.toContain(token);
  });

  it('accepts the email in any case', async () => {
    await expect(
      logIn(at(loginTime), { email: 'HR.Manager@ACME.example', password: PASSWORD }),
    ).resolves.toMatchObject({ user: { email: EMAIL } });
  });

  it('rejects a wrong password', async () => {
    await expect(
      logIn(at(loginTime), { email: EMAIL, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects an unknown email with the same error as a wrong password', async () => {
    const unknownEmail = await logIn(at(loginTime), {
      email: 'nobody@acme.example',
      password: PASSWORD,
    }).catch((error: unknown) => error);
    const wrongPassword = await logIn(at(loginTime), { email: EMAIL, password: 'x' }).catch(
      (error: unknown) => error,
    );

    expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError);
    expect((unknownEmail as Error).message).toBe((wrongPassword as Error).message);
  });

  it('creates no session for a failed login', async () => {
    await logIn(at(loginTime), { email: EMAIL, password: 'wrong' }).catch(() => undefined);

    expect(await testPrisma.session.count()).toBe(0);
  });

  it('rejects a missing email or password', async () => {
    await expect(logIn(at(loginTime), { email: '', password: '' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('authenticate', () => {
  it('returns the signed-in user for a valid token', async () => {
    const { token } = await logIn(at(loginTime), { email: EMAIL, password: PASSWORD });

    expect(await authenticate(at(later(60_000)), token)).toEqual({ email: EMAIL });
  });

  it('accepts a token until just before it expires', async () => {
    const { token } = await logIn(at(loginTime), { email: EMAIL, password: PASSWORD });

    expect(await authenticate(at(later(SESSION_LIFETIME_MS - 1)), token)).not.toBeNull();
  });

  it('rejects an expired token', async () => {
    const { token } = await logIn(at(loginTime), { email: EMAIL, password: PASSWORD });

    expect(await authenticate(at(later(SESSION_LIFETIME_MS)), token)).toBeNull();
  });

  it.each(['', 'not-a-real-token', 'x'.repeat(43)])('rejects the token "%s"', async (token) => {
    expect(await authenticate(at(loginTime), token)).toBeNull();
  });
});

describe('logOut', () => {
  it('ends the session so the token no longer works', async () => {
    const { token } = await logIn(at(loginTime), { email: EMAIL, password: PASSWORD });

    await logOut(at(loginTime), token);

    expect(await authenticate(at(loginTime), token)).toBeNull();
    expect(await testPrisma.session.count()).toBe(0);
  });

  it('does nothing for an unknown token', async () => {
    await expect(logOut(at(loginTime), 'unknown')).resolves.toBeUndefined();
  });

  it('removes expired sessions when someone logs in', async () => {
    await logIn(at(loginTime), { email: EMAIL, password: PASSWORD });

    await logIn(at(later(SESSION_LIFETIME_MS + 1)), { email: EMAIL, password: PASSWORD });

    expect(await testPrisma.session.count()).toBe(1);
  });
});
