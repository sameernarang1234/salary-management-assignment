import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { testMeta } from './fixtures';

export const HR_MANAGER = { email: 'hr.manager@acme.example' };

export const unauthenticated = () =>
  HttpResponse.json(
    { error: { code: 'UNAUTHENTICATED', message: 'Please sign in' } },
    { status: 401 },
  );

/** Default API responses: the HR Manager is signed in. Tests override what they need. */
export const server = setupServer(
  http.get('/api/auth/me', () => HttpResponse.json({ user: HR_MANAGER })),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/meta', () => HttpResponse.json(testMeta)),
);
