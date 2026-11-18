import { describe, expect, it } from 'vitest';
import { toUsd } from '../../src/validators/currency.js';

// Rates are passed as decimal strings, exactly as PostgreSQL numeric(18,8) values arrive.
describe('toUsd', () => {
  it('converts a local amount with the USD rate', () => {
    expect(toUsd(1_200_000, '0.012')).toBe(14_400);
  });

  it('rounds to the nearest whole dollar', () => {
    expect(toUsd(1_000, '0.0123')).toBe(12); // 12.3
    expect(toUsd(1_000, '0.0127')).toBe(13); // 12.7
  });

  it('rounds exact halves up', () => {
    expect(toUsd(1, '2.5')).toBe(3);
    expect(toUsd(5, '0.1')).toBe(1); // 0.5
  });

  it('is exact where floating-point multiplication is not', () => {
    // In floating point 100 * 1.005 is 100.49999999999999, which Math.round turns into 100.
    // The exact product is 100.5, which rounds up to 101.
    expect(toUsd(100, '1.005')).toBe(101);
  });

  it('accepts rates with up to 8 decimal places, as stored', () => {
    expect(toUsd(100_000_000, '0.00000667')).toBe(667);
  });

  it('returns 0 for a zero amount', () => {
    expect(toUsd(0, '0.012')).toBe(0);
  });

  it.each(['', 'abc', '-0.5', '0', '0.00000000', '1e-3', '0.123456789'])(
    'rejects the rate "%s"',
    (rate) => {
      expect(() => toUsd(1_000, rate)).toThrow(/Invalid USD rate/);
    },
  );

  it.each([-1, 10.5, Number.NaN])('rejects the local amount %s', (amount) => {
    expect(() => toUsd(amount, '0.012')).toThrow(/whole number/);
  });
});
