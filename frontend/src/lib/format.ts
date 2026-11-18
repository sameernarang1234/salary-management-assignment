const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** "₹16,80,000", "$120,000", "¥5,000,000": whole units with the currency's usual grouping. */
export function formatMoney(amount: number, currency: string): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** "$761.3M", "$53.1K": for headline figures and chart axes. */
export function formatCompactUsd(amount: number): string {
  return compactUsd.format(amount);
}

const counts = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return counts.format(value);
}

/** "2023-04-01" → "1 Apr 2023", read as UTC so the day never shifts with the time zone. */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
