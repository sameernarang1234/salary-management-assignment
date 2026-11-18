import { describe, expect, it } from 'vitest';
import { createRandom } from '../../src/seed/random.js';

describe('createRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);

    expect(Array.from({ length: 5 }, () => a.next())).toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it('produces a different sequence for a different seed', () => {
    expect(createRandom(1).next()).not.toBe(createRandom(2).next());
  });

  it('returns numbers in [0, 1)', () => {
    const random = createRandom(7);
    const values = Array.from({ length: 10_000 }, () => random.next());

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it('int() stays within the inclusive range and reaches both ends', () => {
    const random = createRandom(3);
    const values = new Set(Array.from({ length: 2_000 }, () => random.int(1, 6)));

    expect([...values].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('weighted() picks according to the weights', () => {
    const random = createRandom(9);
    const picks = Array.from({ length: 10_000 }, () =>
      random.weighted([
        ['common', 9],
        ['rare', 1],
      ]),
    );
    const rare = picks.filter((pick) => pick === 'rare').length;

    expect(rare).toBeGreaterThan(800);
    expect(rare).toBeLessThan(1_200);
  });
});
