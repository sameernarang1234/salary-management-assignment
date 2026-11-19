import { extname, join, relative, resolve, sep } from 'node:path';
import express, { type RequestHandler, type Router } from 'express';

/**
 * Serves the built React app from the same origin as the API, so the SameSite=Strict session
 * cookie works and no CORS is needed.
 * - /assets/* have content-hashed names, so they are cached for a year.
 * - index.html is never cached, so a new release shows up immediately.
 * - Any other page address (e.g. /employees/42) gets index.html, and React Router shows the page.
 */
export function frontendRouter(folder: string): Router {
  // sendFile needs an absolute path; STATIC_DIR may be relative (e.g. ../frontend/dist).
  const staticDir = resolve(folder);
  const router = express.Router();
  const indexFile = join(staticDir, 'index.html');

  router.use(
    express.static(staticDir, {
      index: false,
      setHeaders: (response, filePath) => {
        response.setHeader(
          'Cache-Control',
          relative(staticDir, filePath).split(sep)[0] === 'assets' && !filePath.endsWith('.html')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        );
      },
    }),
  );

  const servePage: RequestHandler = (request, response, next) => {
    // Missing files (anything with an extension) and API routes are not pages.
    if (
      (request.method !== 'GET' && request.method !== 'HEAD') ||
      request.path.startsWith('/api/') ||
      extname(request.path) !== ''
    ) {
      next();
      return;
    }
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(indexFile);
  };
  router.use(servePage);

  return router;
}
