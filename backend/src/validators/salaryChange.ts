import { z } from 'zod';
import { isoDateSchema } from './dates.js';
import { isSameSalary, salaryComponentsSchema, type SalaryComponent } from './salaryComponents.js';

/** Reasons the HR Manager can give. `new_hire` is recorded by the system, never chosen. */
export const SALARY_CHANGE_REASONS = [
  'annual_increment',
  'promotion',
  'correction',
  'other',
] as const;

export type SalaryChangeReason = (typeof SALARY_CHANGE_REASONS)[number];

/** Validates a salary change against the employee's current salary. */
export function salaryChangeSchema(current: readonly SalaryComponent[]) {
  return z.object({
    components: salaryComponentsSchema.refine((next) => !isSameSalary(current, next), {
      error: 'The new salary is the same as the current salary',
    }),
    effectiveDate: isoDateSchema,
    reason: z.enum(SALARY_CHANGE_REASONS, { error: 'Choose a valid reason' }),
  });
}

export type SalaryChangeInput = z.infer<ReturnType<typeof salaryChangeSchema>>;
