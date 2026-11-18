import { describe, expect, it } from 'vitest';
import { employeeInputSchema } from '../../src/validators/employee.js';

const validEmployee = {
  fullName: 'Asha Verma',
  email: 'asha.verma@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  hireDate: '2023-04-01',
};

const fieldErrors = (input: unknown) => {
  const result = employeeInputSchema.safeParse(input);
  expect(result.success).toBe(false);
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  );
};

describe('employeeInputSchema', () => {
  it('accepts a valid employee', () => {
    expect(employeeInputSchema.parse(validEmployee)).toEqual(validEmployee);
  });

  it('trims surrounding spaces from text fields', () => {
    const parsed = employeeInputSchema.parse({
      ...validEmployee,
      fullName: '  Asha Verma ',
      email: ' asha.verma@acme.example ',
      jobTitle: ' Software Engineer',
      department: 'Engineering  ',
    });

    expect(parsed).toEqual(validEmployee);
  });

  it('upper-cases the country code', () => {
    expect(employeeInputSchema.parse({ ...validEmployee, countryCode: 'in' }).countryCode).toBe(
      'IN',
    );
  });

  it.each(['fullName', 'jobTitle', 'department'])('rejects an empty or blank %s', (field) => {
    expect(fieldErrors({ ...validEmployee, [field]: '   ' })[field]).toBe('Required');
  });

  it('reports every missing field', () => {
    expect(Object.keys(fieldErrors({})).sort()).toEqual([
      'countryCode',
      'department',
      'email',
      'fullName',
      'hireDate',
      'jobTitle',
    ]);
  });

  it.each(['asha', 'asha@', '@acme.example', 'asha verma@acme.example', ''])(
    'rejects the invalid email "%s"',
    (email) => {
      expect(fieldErrors({ ...validEmployee, email }).email).toBe('Enter a valid email address');
    },
  );

  it.each(['I', 'IND', '12', ''])('rejects the country code "%s"', (countryCode) => {
    expect(fieldErrors({ ...validEmployee, countryCode }).countryCode).toBe(
      'Use a 2-letter country code',
    );
  });

  it('rejects an impossible hire date', () => {
    expect(fieldErrors({ ...validEmployee, hireDate: '2025-02-30' }).hireDate).toBe(
      'Enter a valid date (YYYY-MM-DD)',
    );
  });

  it('rejects a name longer than 200 characters', () => {
    expect(fieldErrors({ ...validEmployee, fullName: 'a'.repeat(201) }).fullName).toBe(
      'Must be at most 200 characters',
    );
  });
});
