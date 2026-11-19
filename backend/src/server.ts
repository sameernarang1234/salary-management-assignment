import { z } from 'zod';
import { createApp } from './app.js';
import { createPrismaClient } from './db/prisma.js';
import { systemClock } from './services/clock.js';

const config = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.string().default('development'),
    /** Folder with the built frontend; set in the production container. */
    STATIC_DIR: z.string().min(1).optional(),
    /** "true" when running behind the HTTPS proxy (Caddy). */
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .parse(process.env);

const app = createApp({
  db: createPrismaClient(config.DATABASE_URL),
  clock: systemClock,
  secureCookies: config.NODE_ENV === 'production',
  staticDir: config.STATIC_DIR,
  trustProxy: config.TRUST_PROXY,
});

app.listen(config.PORT, () => {
  console.log(`Listening on port ${config.PORT} (${config.NODE_ENV})`);
});
