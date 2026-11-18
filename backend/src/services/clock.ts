/** Injected wherever logic depends on "today", so tests are deterministic. */
export interface Clock {
  /** Today's date as YYYY-MM-DD (UTC). */
  today(): string;
}

export const systemClock: Clock = {
  today: () => new Date().toISOString().slice(0, 10),
};

export function fixedClock(today: string): Clock {
  return { today: () => today };
}
