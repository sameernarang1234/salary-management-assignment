import { z } from 'zod';

export const SALARY_COMPONENT_CODES = ['BASIC', 'HRA', 'HOUSING', 'TRANSPORT', 'SPECIAL'] as const;

export type SalaryComponentCode = (typeof SALARY_COMPONENT_CODES)[number];

/** The fixed catalogue of salary components, in display order. Only Basic is required. */
export const SALARY_COMPONENT_CATALOGUE: readonly {
  code: SalaryComponentCode;
  name: string;
  required: boolean;
}[] = [
  { code: 'BASIC', name: 'Basic', required: true },
  { code: 'HRA', name: 'House Rent Allowance', required: false },
  { code: 'HOUSING', name: 'Housing Allowance', required: false },
  { code: 'TRANSPORT', name: 'Transport Allowance', required: false },
  { code: 'SPECIAL', name: 'Special Allowance', required: false },
];

/**
 * Upper limit for one component's annual amount, in whole local currency units.
 * Five components at this limit total 500,000,000, which fits PostgreSQL's 32-bit `int`.
 */
export const MAX_COMPONENT_AMOUNT = 100_000_000;

const INVALID_AMOUNT = 'Must be a whole number greater than 0';

const annualAmountSchema = z
  .number({ error: INVALID_AMOUNT })
  .int({ error: INVALID_AMOUNT })
  .positive({ error: INVALID_AMOUNT })
  .max(MAX_COMPONENT_AMOUNT, {
    error: `Must be at most ${MAX_COMPONENT_AMOUNT.toLocaleString('en-US')}`,
  });

export const salaryComponentSchema = z.object({
  code: z.enum(SALARY_COMPONENT_CODES, { error: 'Unknown salary component' }),
  annualAmount: annualAmountSchema,
});

/** A complete salary: Basic plus any optional allowances, each component at most once. */
export const salaryComponentsSchema = z
  .array(salaryComponentSchema, { error: 'Salary components must be a list' })
  .superRefine((components, context) => {
    const seen = new Set<SalaryComponentCode>();
    for (const { code } of components) {
      if (seen.has(code)) {
        context.addIssue({ code: 'custom', message: `${code} appears more than once` });
      }
      seen.add(code);
    }
    if (!seen.has('BASIC')) {
      context.addIssue({ code: 'custom', message: 'Basic is required' });
    }
  });

export type SalaryComponent = z.infer<typeof salaryComponentSchema>;
export type SalaryComponents = z.infer<typeof salaryComponentsSchema>;

/** Total annual salary: the sum of its components. */
export function salaryTotal(components: readonly SalaryComponent[]): number {
  return components.reduce((total, component) => total + component.annualAmount, 0);
}

/** True when both salaries have the same components and amounts, in any order. */
export function isSameSalary(
  current: readonly SalaryComponent[],
  next: readonly SalaryComponent[],
): boolean {
  if (current.length !== next.length) {
    return false;
  }
  const currentAmounts = new Map(current.map(({ code, annualAmount }) => [code, annualAmount]));

  return next.every(({ code, annualAmount }) => currentAmounts.get(code) === annualAmount);
}
