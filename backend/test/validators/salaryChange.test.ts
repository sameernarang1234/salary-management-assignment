import { describe, expect, it } from 'vitest';
import { SALARY_CHANGE_REASONS, salaryChangeSchema } from '../../src/validators/salaryChange.js';
import type { SalaryComponents } from '../../src/validators/salaryComponents.js';

const current: SalaryComponents = [
  { code: 'BASIC', annualAmount: 1_200_000 },
  { code: 'HRA', annualAmount: 480_000 },
];

const validChange = {
  components: [
    { code: 'BASIC', annualAmount: 1_320_000 },
    { code: 'HRA', annualAmount: 480_000 },
  ],
  effectiveDate: '2026-04-01',
  reason: 'annual_increment',
};

const fieldErrors = (input: unknown) => {
  const result = salaryChangeSchema(current).safeParse(input);
  expect(result.success).toBe(false);
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  );
};

describe('salary change reasons', () => {
  it('are the four reasons the HR Manager can choose', () => {
    expect(SALARY_CHANGE_REASONS).toEqual(['annual_increment', 'promotion', 'correction', 'other']);
  });
});

describe('salaryChangeSchema', () => {
  it('accepts a valid change', () => {
    expect(salaryChangeSchema(current).parse(validChange)).toEqual(validChange);
  });

  it.each(SALARY_CHANGE_REASONS)('accepts the reason %s', (reason) => {
    expect(salaryChangeSchema(current).safeParse({ ...validChange, reason }).success).toBe(true);
  });

  it('rejects an unknown reason', () => {
    expect(fieldErrors({ ...validChange, reason: 'bonus' }).reason).toBe('Choose a valid reason');
  });

  it('rejects new_hire, which only the system records', () => {
    expect(fieldErrors({ ...validChange, reason: 'new_hire' }).reason).toBe(
      'Choose a valid reason',
    );
  });

  it('rejects an impossible effective date', () => {
    expect(fieldErrors({ ...validChange, effectiveDate: '2025-02-30' }).effectiveDate).toBe(
      'Enter a valid date (YYYY-MM-DD)',
    );
  });

  it('rejects new components without Basic', () => {
    expect(
      fieldErrors({ ...validChange, components: [{ code: 'HRA', annualAmount: 1_000 }] })
        .components,
    ).toBe('Basic is required');
  });

  it('rejects a change identical to the current salary, in any order', () => {
    const unchanged = [
      { code: 'HRA', annualAmount: 480_000 },
      { code: 'BASIC', annualAmount: 1_200_000 },
    ];

    expect(fieldErrors({ ...validChange, components: unchanged }).components).toBe(
      'The new salary is the same as the current salary',
    );
  });

  it('accepts removing an allowance', () => {
    const withoutHra = { ...validChange, components: [{ code: 'BASIC', annualAmount: 1_200_000 }] };

    expect(salaryChangeSchema(current).safeParse(withoutHra).success).toBe(true);
  });
});
