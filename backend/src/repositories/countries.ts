import type { Db } from './db.js';

export interface Country {
  code: string;
  name: string;
  currency: string;
  /** Decimal string, e.g. "0.012", ready for `toUsd`. */
  usdPerUnit: string;
}

const countrySelect = { code: true, name: true, currency: true, usdPerUnit: true } as const;

function toCountry(row: {
  code: string;
  name: string;
  currency: string;
  usdPerUnit: { toFixed(): string };
}): Country {
  // toFixed() never uses exponent notation (unlike toString() for tiny rates).
  return { ...row, usdPerUnit: row.usdPerUnit.toFixed() };
}

export async function listCountries(db: Db): Promise<Country[]> {
  const rows = await db.country.findMany({ select: countrySelect, orderBy: { name: 'asc' } });
  return rows.map(toCountry);
}

export async function findCountryByCode(db: Db, code: string): Promise<Country | null> {
  const row = await db.country.findUnique({ where: { code }, select: countrySelect });
  return row ? toCountry(row) : null;
}
