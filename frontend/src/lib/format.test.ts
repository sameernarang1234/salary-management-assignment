import { formatCompactUsd, formatCount, formatDate, formatMoney } from './format';

describe('formatMoney', () => {
  it('formats whole amounts in the currency, with Indian grouping for rupees', () => {
    expect(formatMoney(1_680_000, 'INR')).toBe('₹16,80,000');
    expect(formatMoney(120_000, 'USD')).toBe('$120,000');
    expect(formatMoney(60_000, 'GBP')).toBe('£60,000');
  });

  it('never shows decimals', () => {
    expect(formatMoney(5_000_000, 'JPY')).toBe('¥5,000,000');
    expect(formatMoney(99_999, 'EUR')).toBe('€99,999');
  });
});

describe('formatDate', () => {
  it('shows a date as "1 Apr 2023", whatever the time zone', () => {
    expect(formatDate('2023-04-01')).toBe('1 Apr 2023');
  });

  it('returns the input unchanged if it is not a date', () => {
    expect(formatDate('not a date')).toBe('not a date');
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(10_000)).toBe('10,000');
  });
});

describe('formatCompactUsd', () => {
  it('shortens large dollar amounts', () => {
    expect(formatCompactUsd(761_300_000)).toBe('$761.3M');
    expect(formatCompactUsd(53_100)).toBe('$53.1K');
  });
});
