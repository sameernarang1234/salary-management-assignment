/** A small seeded random number generator (mulberry32), so generated data is reproducible. */
export interface Random {
  /** A number in [0, 1). */
  next(): number;
  /** A whole number between min and max, inclusive. */
  int(min: number, max: number): number;
  /** A number between min (inclusive) and max (exclusive). */
  between(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  const random: Random = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    between: (min, max) => min + next() * (max - min),
    chance: (probability) => next() < probability,
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) {
        throw new Error('Cannot pick from an empty list');
      }
      return item;
    },
    weighted: (entries) => {
      const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let target = next() * totalWeight;
      for (const [value, weight] of entries) {
        target -= weight;
        if (target < 0) {
          return value;
        }
      }
      return random.pick(entries)[0];
    },
  };
  return random;
}
