/** Injected wherever logic depends on the current time, so tests are deterministic. */
export interface Clock {
  now(): Date;
  /** Today's date as YYYY-MM-DD (UTC). */
  today(): string;
}

const toDay = (date: Date) => date.toISOString().slice(0, 10);

export const systemClock: Clock = {
  now: () => new Date(),
  today: () => toDay(new Date()),
};

/** A clock stopped at `isoDateOrTime`: "2026-06-30" (midnight UTC) or a full ISO timestamp. */
export function fixedClock(isoDateOrTime: string): Clock {
  const fixed = new Date(
    isoDateOrTime.length === 10 ? `${isoDateOrTime}T00:00:00.000Z` : isoDateOrTime,
  );
  if (Number.isNaN(fixed.getTime())) {
    throw new RangeError(`Invalid clock time: ${isoDateOrTime}`);
  }
  return { now: () => new Date(fixed), today: () => toDay(fixed) };
}
