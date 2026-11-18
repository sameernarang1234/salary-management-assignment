import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findSessionUser,
} from '../repositories/sessions.js';
import { findUserByEmail } from '../repositories/users.js';
import { parse, type ServiceContext } from './context.js';
import { InvalidCredentialsError } from './errors.js';

/** Sessions last one working day; the HR Manager signs in again after that. */
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

export interface SignedInUser {
  email: string;
}

const loginSchema = z.object({
  email: z.string({ error: 'Required' }).trim().min(1, { error: 'Required' }),
  password: z.string({ error: 'Required' }).min(1, { error: 'Required' }),
});

/** Only this hash is stored, so a leaked database does not leak usable session tokens. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Checked against when the email is unknown, so both failures take about the same time. */
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password'));

export async function logIn(
  context: ServiceContext,
  input: unknown,
): Promise<{ token: string; expiresAt: string; user: SignedInUser }> {
  const { email, password } = parse(loginSchema, input);
  const user = await findUserByEmail(context.db, email);
  const passwordMatches = await verifyPassword(
    password,
    user?.passwordHash ?? (await getDummyHash()),
  );
  if (!user || !passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const now = context.clock.now();
  await deleteExpiredSessions(context.db, now);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
  await createSession(context.db, { tokenHash: hashToken(token), userId: user.id, expiresAt });

  return { token, expiresAt: expiresAt.toISOString(), user: { email: user.email } };
}

/** The signed-in user for a session token, or null if it is missing, unknown or expired. */
export async function authenticate(
  context: ServiceContext,
  token: string | undefined,
): Promise<SignedInUser | null> {
  if (!token) {
    return null;
  }
  return findSessionUser(context.db, hashToken(token), context.clock.now());
}

export async function logOut(context: ServiceContext, token: string | undefined): Promise<void> {
  if (token) {
    await deleteSession(context.db, hashToken(token));
  }
}
