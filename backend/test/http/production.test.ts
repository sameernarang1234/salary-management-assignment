import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { fixedClock } from '../../src/services/clock.js';
import { testPrisma } from '../helpers/database.js';

let staticDir: string;

const productionApp = (overrides: { staticDir?: string; trustProxy?: boolean } = {}) =>
  createApp({
    db: testPrisma,
    clock: fixedClock('2026-06-30'),
    secureCookies: true,
    ...overrides,
  });

beforeAll(() => {
  // A stand-in for the built frontend (frontend/dist).
  staticDir = mkdtempSync(join(tmpdir(), 'salary-frontend-'));
  writeFileSync(
    join(staticDir, 'index.html'),
    '<!doctype html><title>ACME</title><div id="root"></div>',
  );
  mkdirSync(join(staticDir, 'assets'));
  writeFileSync(join(staticDir, 'assets', 'index-abc123.js'), 'console.log("app");');
});

afterAll(async () => {
  rmSync(staticDir, { recursive: true, force: true });
  await testPrisma.$disconnect();
});

describe('serving the built frontend', () => {
  it('serves the app at the root, never cached so new releases show up at once', async () => {
    const response = await request(productionApp({ staticDir })).get('/');

    expect(response.status).toBe(200);
    expect(response.get('Content-Type')).toMatch(/text\/html/);
    expect(response.text).toContain('<div id="root"></div>');
    expect(response.get('Cache-Control')).toBe('no-cache');
  });

  it.each(['/employees', '/employees/42', '/login', '/employees?country=IN&status=all'])(
    'serves the app for the page address %s, so reloading a page works',
    async (path) => {
      const response = await request(productionApp({ staticDir })).get(path);

      expect(response.status).toBe(200);
      expect(response.text).toContain('<div id="root"></div>');
    },
  );

  it('serves built assets with a long cache, since their names change with each build', async () => {
    const response = await request(productionApp({ staticDir })).get('/assets/index-abc123.js');

    expect(response.status).toBe(200);
    expect(response.text).toContain('console.log("app")');
    expect(response.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('returns 404 for a missing file instead of the app page', async () => {
    const response = await request(productionApp({ staticDir })).get('/assets/missing.js');

    expect(response.status).toBe(404);
    expect(response.text).not.toContain('<div id="root"></div>');
  });

  it('keeps API routes as JSON: unknown API routes are never answered with the app page', async () => {
    const response = await request(productionApp({ staticDir })).get('/api/unknown');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('keeps the health check working', async () => {
    const response = await request(productionApp({ staticDir })).get('/api/health');

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('accepts the frontend folder as a relative path (e.g. STATIC_DIR=../frontend/dist)', async () => {
    // Inside the project, so the path really is relative (a temp folder may be on another drive).
    const localDir = mkdtempSync(join(process.cwd(), 'tmp-frontend-'));
    try {
      writeFileSync(join(localDir, 'index.html'), '<div id="root"></div>');
      mkdirSync(join(localDir, 'assets'));
      writeFileSync(join(localDir, 'assets', 'app-1.js'), 'x');
      const relativeDir = relative(process.cwd(), localDir);
      expect(relativeDir.startsWith('tmp-frontend-')).toBe(true);

      const page = await request(productionApp({ staticDir: relativeDir })).get('/employees/42');
      const asset = await request(productionApp({ staticDir: relativeDir })).get(
        '/assets/app-1.js',
      );

      expect(page.status).toBe(200);
      expect(page.text).toContain('<div id="root"></div>');
      expect(asset.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    } finally {
      rmSync(localDir, { recursive: true, force: true });
    }
  });

  it('serves no pages when no frontend folder is configured (development and tests)', async () => {
    expect((await request(productionApp()).get('/')).status).toBe(404);
  });
});

describe('running behind the HTTPS proxy (Caddy)', () => {
  it('trusts one proxy hop when configured, so the client IP and protocol are read correctly', () => {
    expect(productionApp({ trustProxy: true }).get('trust proxy')).toBe(1);
  });

  it('trusts no proxy by default', () => {
    expect(productionApp().get('trust proxy')).toBe(false);
  });
});
