import type { ServiceContext } from '../services/context.js';

/** Everything the HTTP app needs, injected so tests can use the test database and a fixed clock. */
export interface AppDependencies extends ServiceContext {
  /** Send the session cookie over HTTPS only (true in production). */
  secureCookies: boolean;
  /** Folder with the built frontend (frontend/dist). When set, Express serves the app's pages. */
  staticDir?: string;
  /** Trust one proxy hop (Caddy in production), so the client IP and protocol are read correctly. */
  trustProxy?: boolean;
}
