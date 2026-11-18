import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { findCountryByCode, listCountries } from '../../src/repositories/countries.js';
import { insertEmployee, markEmployeeLeft } from '../../src/repositories/employees.js';
import { getFilterOptions } from '../../src/repositories/filterOptions.js';
import { insertTestCountries, resetDatabase, testPrisma } from '../helpers/database.js';

beforeEach(async () => {
  await resetDatabase();
  await insertTestCountries();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('countries repository', () => {
  it('lists all countries by name, with rates as decimal strings', async () => {
    expect(await listCountries(testPrisma)).toEqual([
      { code: 'IN', name: 'India', currency: 'INR', usdPerUnit: '0.012' },
      { code: 'GB', name: 'United Kingdom', currency: 'GBP', usdPerUnit: '1.27' },
      { code: 'US', name: 'United States', currency: 'USD', usdPerUnit: '1' },
    ]);
  });

  it('writes very small rates without exponent notation', async () => {
    await testPrisma.country.create({
      data: { code: 'VN', name: 'Vietnam', currency: 'VND', usdPerUnit: '0.00000004' },
    });

    expect((await findCountryByCode(testPrisma, 'VN'))?.usdPerUnit).toBe('0.00000004');
  });

  it('finds a country by code', async () => {
    expect(await findCountryByCode(testPrisma, 'GB')).toEqual({
      code: 'GB',
      name: 'United Kingdom',
      currency: 'GBP',
      usdPerUnit: '1.27',
    });
  });

  it.each(['ZZ', '', "IN' OR '1'='1"])('returns null for the unknown code "%s"', async (code) => {
    expect(await findCountryByCode(testPrisma, code)).toBeNull();
  });
});

describe('filter options repository', () => {
  it('lists distinct departments and job titles of active employees, sorted', async () => {
    const base = { countryCode: 'IN', hireDate: '2023-01-01' };
    await insertEmployee(testPrisma, {
      ...base,
      fullName: 'A',
      email: 'a@acme.example',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
    });
    await insertEmployee(testPrisma, {
      ...base,
      fullName: 'B',
      email: 'b@acme.example',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
    });
    await insertEmployee(testPrisma, {
      ...base,
      fullName: 'C',
      email: 'c@acme.example',
      jobTitle: 'Accountant',
      department: 'Finance',
    });
    const leaver = await insertEmployee(testPrisma, {
      ...base,
      fullName: 'D',
      email: 'd@acme.example',
      jobTitle: 'Recruiter',
      department: 'People',
    });
    await markEmployeeLeft(testPrisma, leaver.id, '2025-01-31');

    expect(await getFilterOptions(testPrisma)).toEqual({
      departments: ['Engineering', 'Finance'],
      jobTitles: ['Accountant', 'Software Engineer'],
    });
  });

  it('returns empty lists when there are no employees', async () => {
    expect(await getFilterOptions(testPrisma)).toEqual({ departments: [], jobTitles: [] });
  });
});
