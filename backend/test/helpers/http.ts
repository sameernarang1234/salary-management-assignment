import { createHash, randomBytes } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { setHrManagerAccount } from '../../src/repositories/users.js';
import { fixedClock } from '../../src/services/clock.js';
import { testPrisma } from './database.js';

export const TEST_NOW = '2026-06-30T09:00:00.000Z';

export const testApp = () =>
  createApp({ db: testPrisma, clock: fixedClock(TEST_NOW), secureCookies: false });

/**
 * Creates the HR Manager account and a valid session directly in the database, returning the
 * Cookie header value. (Logging in through the API is covered by test/http/auth.test.ts; this
 * avoids a slow password hash in every test.)
 */
export async function signIn(): Promise<string> {
  await setHrManagerAccount(testPrisma, 'hr.manager@acme.example', 'not-used-in-these-tests');
  const token = randomBytes(32).toString('base64url');
  await testPrisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: 1,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    },
  });
  return `session=${token}`;
}
