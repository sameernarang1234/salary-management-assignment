/** Rates are stored as numeric(18,8): a positive decimal with up to 8 decimal places. */
const RATE_PATTERN = /^\d+(\.\d{1,8})?$/;
const RATE_DECIMALS = 8;
const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);

/**
 * Converts a whole local-currency amount to whole US dollars, rounding halves up.
 *
 * The rate is a decimal string (as PostgreSQL returns `numeric`) and the multiplication is done
 * in integers, so results are exact: 100 × 1.005 is 100.5 and rounds to 101, whereas
 * floating-point arithmetic gives 100.49999999999999 and rounds to 100.
 */
export function toUsd(localAmount: number, usdPerUnit: string): number {
  if (!Number.isSafeInteger(localAmount) || localAmount < 0) {
    throw new RangeError(`Local amount must be a whole number of at least 0, got ${localAmount}`);
  }
  if (!RATE_PATTERN.test(usdPerUnit)) {
    throw new RangeError(`Invalid USD rate "${usdPerUnit}"`);
  }
  const [whole = '', fraction = ''] = usdPerUnit.split('.');
  const scaledRate = BigInt(whole + fraction.padEnd(RATE_DECIMALS, '0'));
  if (scaledRate === 0n) {
    throw new RangeError(`Invalid USD rate "${usdPerUnit}"`);
  }
  const scaledUsd = BigInt(localAmount) * scaledRate;

  return Number((scaledUsd + RATE_SCALE / 2n) / RATE_SCALE);
}
