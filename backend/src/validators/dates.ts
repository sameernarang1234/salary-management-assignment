import { z } from 'zod';

const INVALID_DATE = 'Enter a valid date (YYYY-MM-DD)';
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as YYYY-MM-DD (rejects 2025-02-30, 2025-13-01, ...). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** A calendar date with no time or time zone, e.g. a hire date or an effective date. */
export const isoDateSchema = z
  .string({ error: INVALID_DATE })
  .refine(isValidIsoDate, { error: INVALID_DATE });
