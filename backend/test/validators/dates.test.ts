import { describe, expect, it } from 'vitest';
import { isoDateSchema } from '../../src/validators/dates.js';

describe('isoDateSchema', () => {
  it.each(['2025-01-31', '2024-02-29', '2000-02-29'])('accepts the real date %s', (date) => {
    expect(isoDateSchema.parse(date)).toBe(date);
  });

  it.each([
    ['a day that does not exist', '2025-02-30'],
    ['29 February in a non-leap year', '2025-02-29'],
    ['29 February in a century non-leap year', '1900-02-29'],
    ['month 13', '2025-13-01'],
    ['day 00', '2025-01-00'],
    ['a different format', '31/01/2025'],
    ['a date with a time', '2025-01-31T10:00:00Z'],
    ['an empty string', ''],
    ['a number', 20250131],
  ])('rejects %s (%s)', (_label, date) => {
    const result = isoDateSchema.safeParse(date);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Enter a valid date (YYYY-MM-DD)');
  });
});
