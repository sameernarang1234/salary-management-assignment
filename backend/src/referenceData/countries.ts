/**
 * Countries ACME employs people in, with a static USD reference rate per currency unit.
 * The rates are illustrative, fixed on RATES_AS_OF so reports are reproducible (see
 * docs/REQUIREMENTS.md: live exchange rates are deliberately left out). The seed script loads
 * these into the `countries` table.
 */
export const RATES_AS_OF = '2026-01-01';

export const REFERENCE_COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', usdPerUnit: '0.012' },
  { code: 'US', name: 'United States', currency: 'USD', usdPerUnit: '1' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', usdPerUnit: '1.27' },
  { code: 'DE', name: 'Germany', currency: 'EUR', usdPerUnit: '1.09' },
  { code: 'FR', name: 'France', currency: 'EUR', usdPerUnit: '1.09' },
  { code: 'CA', name: 'Canada', currency: 'CAD', usdPerUnit: '0.74' },
  { code: 'AU', name: 'Australia', currency: 'AUD', usdPerUnit: '0.66' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', usdPerUnit: '0.75' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', usdPerUnit: '0.2723' },
  { code: 'JP', name: 'Japan', currency: 'JPY', usdPerUnit: '0.0067' },
] as const;
