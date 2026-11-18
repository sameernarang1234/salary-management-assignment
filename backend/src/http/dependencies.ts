import type { ServiceContext } from '../services/context.js';

/** Everything the HTTP app needs, injected so tests can use the test database and a fixed clock. */
export interface AppDependencies extends ServiceContext {
  /** Send the session cookie over HTTPS only (true in production). */
  secureCookies: boolean;
}
