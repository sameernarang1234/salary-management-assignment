import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { authRouter, requireSession } from './http/auth.js';
import type { AppDependencies } from './http/dependencies.js';
import { errorHandler, notFound } from './http/errors.js';

export type { AppDependencies } from './http/dependencies.js';

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Public routes.
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter(dependencies));

  // Everything else under /api requires a session.
  app.use('/api', requireSession(dependencies));

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
