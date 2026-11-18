import { z } from 'zod';
import { isoDateSchema } from './dates.js';

const INVALID_EMAIL = 'Enter a valid email address';
const INVALID_COUNTRY_CODE = 'Use a 2-letter country code';

const requiredText = (maxLength: number) =>
  z
    .string({ error: 'Required' })
    .trim()
    .min(1, { error: 'Required' })
    .max(maxLength, { error: `Must be at most ${maxLength} characters` });

/**
 * An employee's details as entered by the HR Manager.
 * Whether the country exists and the email is unique is checked against the database later.
 */
export const employeeInputSchema = z.object({
  fullName: requiredText(200),
  email: z
    .string({ error: INVALID_EMAIL })
    .trim()
    .max(254, { error: 'Must be at most 254 characters' })
    .pipe(z.email({ error: INVALID_EMAIL })),
  jobTitle: requiredText(100),
  department: requiredText(100),
  countryCode: z
    .string({ error: INVALID_COUNTRY_CODE })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { error: INVALID_COUNTRY_CODE }),
  hireDate: isoDateSchema,
});

export type EmployeeInput = z.infer<typeof employeeInputSchema>;
