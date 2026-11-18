import { z } from 'zod';
import { createApp } from './app.js';
import { createPrismaClient } from './db/prisma.js';
import { systemClock } from './services/clock.js';

const config = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.string().default('development'),
  })
  .parse(process.env);

const app = createApp({
  db: createPrismaClient(config.DATABASE_URL),
  clock: systemClock,
  secureCookies: config.NODE_ENV === 'production',
});

app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});
