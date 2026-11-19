import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { authRouter, requireSession } from './http/auth.js';
import type { AppDependencies } from './http/dependencies.js';
import { employeesRouter } from './http/employees.js';
import { errorHandler, notFound } from './http/errors.js';
import { frontendRouter } from './http/frontend.js';
import { insightsRouter } from './http/insights.js';
import { metaRouter } from './http/meta.js';

export type { AppDependencies } from './http/dependencies.js';

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  if (dependencies.trustProxy) {
    // One hop: Caddy terminates HTTPS in front of the app.
    app.set('trust proxy', 1);
  }
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Public routes.
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter(dependencies));

  // Everything else under /api requires a session.
  app.use('/api', requireSession(dependencies));
  app.use('/api/employees', employeesRouter(dependencies));
  app.use('/api/insights', insightsRouter(dependencies));
  app.use('/api/meta', metaRouter(dependencies));

  app.use('/api', notFound);

  // Production: the built frontend, from the same origin as the API.
  if (dependencies.staticDir) {
    app.use(frontendRouter(dependencies.staticDir));
  }

  app.use(errorHandler);
  return app;
}
