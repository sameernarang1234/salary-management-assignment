import { Router, type CookieOptions, type Request, type RequestHandler } from 'express';
import { SESSION_LIFETIME_MS, authenticate, logIn, logOut } from '../services/auth.js';
import type { AppDependencies } from './dependencies.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'session';

function readSessionToken(request: Request): string | undefined {
  const token: unknown = request.cookies?.[SESSION_COOKIE];
  return typeof token === 'string' ? token : undefined;
}

function cookieOptions(dependencies: AppDependencies): CookieOptions {
  return {
    httpOnly: true, // not readable by JavaScript
    sameSite: 'strict', // not sent on requests from other sites (CSRF protection)
    secure: dependencies.secureCookies, // HTTPS only in production
    path: '/',
  };
}

/** Rejects the request with 401 unless it carries a valid session; stores the user in res.locals. */
export function requireSession(dependencies: AppDependencies): RequestHandler {
  return async (request, response, next) => {
    const user = await authenticate(dependencies, readSessionToken(request));
    if (!user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in');
    }
    response.locals.user = user;
    next();
  };
}

export function authRouter(dependencies: AppDependencies): Router {
  const router = Router();

  router.post('/login', async (request, response) => {
    const session = await logIn(dependencies, request.body);
    response.cookie(SESSION_COOKIE, session.token, {
      ...cookieOptions(dependencies),
      maxAge: SESSION_LIFETIME_MS,
    });
    response.json({ user: session.user });
  });

  router.post('/logout', async (request, response) => {
    await logOut(dependencies, readSessionToken(request));
    response.clearCookie(SESSION_COOKIE, cookieOptions(dependencies));
    response.status(204).end();
  });

  router.get('/me', requireSession(dependencies), (_request, response) => {
    response.json({ user: response.locals.user });
  });

  return router;
}
