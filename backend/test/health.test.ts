import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { fixedClock } from '../src/services/clock.js';
import { testPrisma } from './helpers/database.js';

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('GET /api/health', () => {
  it('responds 200 with status ok, without a session', async () => {
    const app = createApp({
      db: testPrisma,
      clock: fixedClock('2026-06-30'),
      secureCookies: false,
    });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
