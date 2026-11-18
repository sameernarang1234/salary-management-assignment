import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { hashPassword } from '../../src/auth/password.js';
import { setHrManagerAccount } from '../../src/repositories/users.js';
import { SESSION_LIFETIME_MS } from '../../src/services/auth.js';
import { fixedClock } from '../../src/services/clock.js';
import { resetDatabase, testPrisma } from '../helpers/database.js';

const EMAIL = 'hr.manager@acme.example';
const PASSWORD = 'Correct-Horse-42';
const NOW = '2026-06-30T09:00:00.000Z';

const appAt = (iso: string, secureCookies = false) =>
  createApp({ db: testPrisma, clock: fixedClock(iso), secureCookies });

async function sessionCookie(app = appAt(NOW)): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: EMAIL, password: PASSWORD });
  const [cookie] = response.get('Set-Cookie') ?? [];
  return cookie!.split(';')[0]!;
}

beforeAll(async () => {
  await resetDatabase();
  await setHrManagerAccount(testPrisma, EMAIL, await hashPassword(PASSWORD));
});

beforeEach(async () => {
  await testPrisma.session.deleteMany();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('sets an httpOnly, SameSite=Strict session cookie and returns the user', async () => {
    const response = await request(appAt(NOW))
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: { email: EMAIL } });
    const cookie = response.get('Set-Cookie')?.[0] ?? '';
    expect(cookie).toMatch(/^session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${SESSION_LIFETIME_MS / 1000}`);
    expect(cookie).not.toContain('Secure');
  });

  it('marks the cookie Secure when configured for production', async () => {
    const response = await request(appAt(NOW, true))
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(response.get('Set-Cookie')?.[0]).toContain('Secure');
  });

  it('returns 401 in the standard error format for a wrong password', async () => {
    const response = await request(appAt(NOW))
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'wrong' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' },
    });
    expect(response.get('Set-Cookie')).toBeUndefined();
  });

  it('returns 400 with field errors for a missing email and password', async () => {
    const response = await request(appAt(NOW)).post('/api/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { email: expect.any(String), password: expect.any(String) },
    });
  });

  it('returns 400 for a body that is not JSON', async () => {
    const response = await request(appAt(NOW))
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{not json');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the signed-in user', async () => {
    const cookie = await sessionCookie();

    const response = await request(appAt(NOW)).get('/api/auth/me').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: { email: EMAIL } });
  });

  it('returns 401 without a session cookie', async () => {
    const response = await request(appAt(NOW)).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Please sign in' },
    });
  });

  it('returns 401 for an expired session', async () => {
    const cookie = await sessionCookie();
    const afterExpiry = new Date(Date.parse(NOW) + SESSION_LIFETIME_MS).toISOString();

    const response = await request(appAt(afterExpiry)).get('/api/auth/me').set('Cookie', cookie);

    expect(response.status).toBe(401);
  });

  it('returns 401 for a made-up session cookie', async () => {
    const response = await request(appAt(NOW))
      .get('/api/auth/me')
      .set('Cookie', `session=${'a'.repeat(43)}`);

    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session and clears the cookie', async () => {
    const app = appAt(NOW);
    const cookie = await sessionCookie(app);

    const response = await request(app).post('/api/auth/logout').set('Cookie', cookie);

    expect(response.status).toBe(204);
    expect(response.get('Set-Cookie')?.[0]).toMatch(/^session=;.*Expires=Thu, 01 Jan 1970/);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('succeeds even without a session', async () => {
    expect((await request(appAt(NOW)).post('/api/auth/logout')).status).toBe(204);
  });
});

describe('every /api route except login, logout and health requires a session', () => {
  it.each([
    ['get', '/api/employees'],
    ['post', '/api/employees'],
    ['get', '/api/employees/1'],
    ['put', '/api/employees/1'],
    ['post', '/api/employees/1/salary'],
    ['get', '/api/insights/overview'],
    ['get', '/api/meta'],
    ['get', '/api/route-that-does-not-exist'],
  ] as const)('%s %s returns 401 without a session', async (method, path) => {
    const response = await request(appAt(NOW))[method](path);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 404 in the standard format for an unknown route when signed in', async () => {
    const cookie = await sessionCookie();

    const response = await request(appAt(NOW))
      .get('/api/route-that-does-not-exist')
      .set('Cookie', cookie);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  it('keeps the health check public', async () => {
    expect((await request(appAt(NOW)).get('/api/health')).status).toBe(200);
  });
});
