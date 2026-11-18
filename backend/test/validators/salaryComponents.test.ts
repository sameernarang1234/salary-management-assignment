import { describe, expect, it } from 'vitest';
import {
  MAX_COMPONENT_AMOUNT,
  SALARY_COMPONENT_CATALOGUE,
  isSameSalary,
  salaryComponentsSchema,
  salaryTotal,
} from '../../src/validators/salaryComponents.js';

describe('salary component catalogue', () => {
  it('lists the five components in display order with their names', () => {
    expect(SALARY_COMPONENT_CATALOGUE.map(({ code, name }) => [code, name])).toEqual([
      ['BASIC', 'Basic'],
      ['HRA', 'House Rent Allowance'],
      ['HOUSING', 'Housing Allowance'],
      ['TRANSPORT', 'Transport Allowance'],
      ['SPECIAL', 'Special Allowance'],
    ]);
  });

  it('marks only BASIC as required', () => {
    const required = SALARY_COMPONENT_CATALOGUE.filter((component) => component.required);

    expect(required.map((component) => component.code)).toEqual(['BASIC']);
  });
});

describe('salaryTotal', () => {
  it('is the sum of the component amounts', () => {
    expect(
      salaryTotal([
        { code: 'BASIC', annualAmount: 1_200_000 },
        { code: 'HRA', annualAmount: 480_000 },
        { code: 'TRANSPORT', annualAmount: 19_200 },
      ]),
    ).toBe(1_699_200);
  });

  it('is the Basic amount when Basic is the only component', () => {
    expect(salaryTotal([{ code: 'BASIC', annualAmount: 50_000 }])).toBe(50_000);
  });
});

describe('salaryComponentsSchema', () => {
  const errorFor = (input: unknown) => {
    const result = salaryComponentsSchema.safeParse(input);
    expect(result.success).toBe(false);
    return result.error?.issues.map((issue) => issue.message).join(' | ');
  };

  it('accepts Basic with optional allowances', () => {
    const components = [
      { code: 'BASIC', annualAmount: 1_200_000 },
      { code: 'SPECIAL', annualAmount: 100_000 },
    ];

    expect(salaryComponentsSchema.parse(components)).toEqual(components);
  });

  it('rejects components without Basic', () => {
    expect(errorFor([{ code: 'HRA', annualAmount: 1_000 }])).toMatch(/Basic is required/);
  });

  it('rejects an empty list', () => {
    expect(errorFor([])).toMatch(/Basic is required/);
  });

  it('rejects the same component twice', () => {
    expect(
      errorFor([
        { code: 'BASIC', annualAmount: 1_000 },
        { code: 'BASIC', annualAmount: 2_000 },
      ]),
    ).toMatch(/BASIC appears more than once/);
  });

  it('rejects a component that is not in the catalogue', () => {
    expect(
      errorFor([
        { code: 'BASIC', annualAmount: 1_000 },
        { code: 'BONUS', annualAmount: 500 },
      ]),
    ).toMatch(/Unknown salary component/);
  });

  it.each([
    ['zero', 0],
    ['negative', -100],
    ['decimal', 1000.5],
  ])('rejects a %s amount', (_label, annualAmount) => {
    expect(errorFor([{ code: 'BASIC', annualAmount }])).toMatch(/whole number greater than 0/);
  });

  it('accepts an amount at the upper limit and rejects one above it', () => {
    expect(
      salaryComponentsSchema.safeParse([{ code: 'BASIC', annualAmount: MAX_COMPONENT_AMOUNT }])
        .success,
    ).toBe(true);
    expect(errorFor([{ code: 'BASIC', annualAmount: MAX_COMPONENT_AMOUNT + 1 }])).toMatch(
      /at most 100,000,000/,
    );
  });

  it('rejects an amount sent as a string', () => {
    expect(errorFor([{ code: 'BASIC', annualAmount: '1000' }])).toMatch(
      /whole number greater than 0/,
    );
  });
});

describe('isSameSalary', () => {
  it('is true for the same components in a different order', () => {
    expect(
      isSameSalary(
        [
          { code: 'BASIC', annualAmount: 1_000 },
          { code: 'HRA', annualAmount: 200 },
        ],
        [
          { code: 'HRA', annualAmount: 200 },
          { code: 'BASIC', annualAmount: 1_000 },
        ],
      ),
    ).toBe(true);
  });

  it('is false when an amount differs', () => {
    expect(
      isSameSalary(
        [{ code: 'BASIC', annualAmount: 1_000 }],
        [{ code: 'BASIC', annualAmount: 1_001 }],
      ),
    ).toBe(false);
  });

  it('is false when a component is added or removed', () => {
    expect(
      isSameSalary(
        [{ code: 'BASIC', annualAmount: 1_000 }],
        [
          { code: 'BASIC', annualAmount: 1_000 },
          { code: 'TRANSPORT', annualAmount: 100 },
        ],
      ),
    ).toBe(false);
  });
});
