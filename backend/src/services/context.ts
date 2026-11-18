import type { z } from 'zod';
import type { Db } from '../repositories/db.js';
import type { Clock } from './clock.js';
import { ValidationError } from './errors.js';

/** What every service needs: database access and the current time. */
export interface ServiceContext {
  db: Db;
  clock: Clock;
}

/** Parses untrusted input, turning Zod issues into a ValidationError with errors per field. */
export function parse<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}
