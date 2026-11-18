import type { EmployeeInput, SalaryChangeReason } from '../../../api/types';
import { isValidIsoDate } from '../../../lib/dates';

export type EmployeeFormValues = EmployeeInput;
export type EmployeeFormErrors = Partial<Record<keyof EmployeeFormValues, string>>;

export const EMPTY_EMPLOYEE: EmployeeFormValues = {
  fullName: '',
  email: '',
  jobTitle: '',
  department: '',
  countryCode: '',
  hireDate: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function detailsFromEmployee(employee: EmployeeInput): EmployeeFormValues {
  const { fullName, email, jobTitle, department, countryCode, hireDate } = employee;
  return { fullName, email, jobTitle, department, countryCode, hireDate };
}

/** Rejects a missing, impossible, future or (optionally) pre-hire date. */
function dateError(
  value: string,
  label: string,
  { today, hireDate }: { today: string; hireDate?: string },
): string | undefined {
  if (!value) {
    return 'Required';
  }
  if (!isValidIsoDate(value)) {
    return 'Enter a valid date';
  }
  if (value > today) {
    return `${label} cannot be in the future`;
  }
  if (hireDate !== undefined && value < hireDate) {
    return `${label} cannot be before the hire date`;
  }
  return undefined;
}

/** The same rules as the server, checked before sending. */
export function validateEmployeeDetails(
  values: EmployeeFormValues,
  today: string,
): EmployeeFormErrors {
  const errors: EmployeeFormErrors = {};
  const requireText = (field: 'fullName' | 'jobTitle' | 'department', maxLength: number) => {
    const value = values[field].trim();
    if (!value) {
      errors[field] = 'Required';
    } else if (value.length > maxLength) {
      errors[field] = `Must be at most ${maxLength} characters`;
    }
  };
  requireText('fullName', 200);
  requireText('jobTitle', 100);
  requireText('department', 100);

  const email = values.email.trim();
  if (!email) {
    errors.email = 'Required';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address';
  }
  if (!values.countryCode) {
    errors.countryCode = 'Choose a country';
  }
  const hireDateError = dateError(values.hireDate, 'Hire date', { today });
  if (hireDateError) {
    errors.hireDate = hireDateError;
  }
  return errors;
}

export function validateSalaryChange(
  values: { effectiveDate: string; reason: SalaryChangeReason | '' },
  context: { today: string; hireDate: string },
): { effectiveDate?: string; reason?: string } {
  const errors: { effectiveDate?: string; reason?: string } = {};
  const effectiveDateError = dateError(values.effectiveDate, 'Effective date', context);
  if (effectiveDateError) {
    errors.effectiveDate = effectiveDateError;
  }
  if (!values.reason) {
    errors.reason = 'Choose a reason';
  }
  return errors;
}

export function validateLeaving(
  leftOn: string,
  context: { today: string; hireDate: string },
): string | undefined {
  return dateError(leftOn, 'Leaving date', context);
}

/** Trims text fields before sending. */
export function cleanDetails(values: EmployeeFormValues): EmployeeInput {
  return {
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    jobTitle: values.jobTitle.trim(),
    department: values.department.trim(),
    countryCode: values.countryCode,
    hireDate: values.hireDate,
  };
}
