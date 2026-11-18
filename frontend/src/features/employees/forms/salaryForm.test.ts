import { testMeta } from '../../../test/fixtures';
import {
  amountsFromComponents,
  componentErrorsFromServer,
  componentsFromAmounts,
  isSameSalary,
  totalOf,
} from './salaryForm';

const catalogue = testMeta.salaryComponents;

describe('componentsFromAmounts', () => {
  it('turns the filled-in amounts into components, in catalogue order, skipping blanks', () => {
    expect(
      componentsFromAmounts(
        { SPECIAL: '50000', BASIC: '1200000', HRA: '', TRANSPORT: ' ' },
        catalogue,
      ),
    ).toEqual({
      components: [
        { code: 'BASIC', annualAmount: 1_200_000 },
        { code: 'SPECIAL', annualAmount: 50_000 },
      ],
      errors: {},
    });
  });

  it('accepts thousands separators and spaces', () => {
    expect(componentsFromAmounts({ BASIC: '12,00,000' }, catalogue).components).toEqual([
      { code: 'BASIC', annualAmount: 1_200_000 },
    ]);
    expect(componentsFromAmounts({ BASIC: '1 200 000' }, catalogue).components).toEqual([
      { code: 'BASIC', annualAmount: 1_200_000 },
    ]);
  });

  it('requires Basic', () => {
    expect(componentsFromAmounts({ HRA: '1000' }, catalogue).errors).toEqual({
      BASIC: 'Basic is required',
    });
  });

  it.each(['0', '-5', '12.5', 'abc', '1e5'])('rejects the amount "%s"', (amount) => {
    expect(componentsFromAmounts({ BASIC: '1000', HRA: amount }, catalogue).errors).toEqual({
      HRA: 'Enter a whole number greater than 0',
    });
  });

  it('rejects an amount above 100,000,000', () => {
    expect(componentsFromAmounts({ BASIC: '100000001' }, catalogue).errors).toEqual({
      BASIC: 'Must be at most 100,000,000',
    });
    expect(componentsFromAmounts({ BASIC: '100000000' }, catalogue).errors).toEqual({});
  });
});

describe('amountsFromComponents', () => {
  it('fills the form from existing components', () => {
    expect(
      amountsFromComponents([
        { code: 'BASIC', annualAmount: 1_200_000 },
        { code: 'HRA', annualAmount: 480_000 },
      ]),
    ).toEqual({ BASIC: '1200000', HRA: '480000' });
  });
});

describe('totalOf', () => {
  it('adds up the valid amounts as the HR Manager types', () => {
    expect(totalOf({ BASIC: '1,200,000', HRA: '480000', SPECIAL: 'oops' })).toBe(1_680_000);
    expect(totalOf({})).toBe(0);
  });
});

describe('isSameSalary', () => {
  it('ignores order and spots any difference', () => {
    const current = [
      { code: 'BASIC' as const, annualAmount: 1_000 },
      { code: 'HRA' as const, annualAmount: 200 },
    ];

    expect(isSameSalary(current, [...current].reverse())).toBe(true);
    expect(isSameSalary(current, [{ code: 'BASIC', annualAmount: 1_000 }])).toBe(false);
    expect(
      isSameSalary(current, [
        { code: 'BASIC', annualAmount: 1_000 },
        { code: 'HRA', annualAmount: 201 },
      ]),
    ).toBe(false);
  });
});

describe('componentErrorsFromServer', () => {
  const submitted = [
    { code: 'BASIC' as const, annualAmount: 1_000 },
    { code: 'HRA' as const, annualAmount: 0 },
  ];

  it('puts errors about one component next to that component', () => {
    expect(
      componentErrorsFromServer(
        { 'components.1.annualAmount': 'Must be a whole number greater than 0' },
        submitted,
      ),
    ).toEqual({ byCode: { HRA: 'Must be a whole number greater than 0' } });
  });

  it('reports errors about the components as a whole separately', () => {
    expect(
      componentErrorsFromServer(
        { components: 'The new salary is the same as the current salary', email: 'x' },
        submitted,
      ),
    ).toEqual({ byCode: {}, general: 'The new salary is the same as the current salary' });
  });
});
