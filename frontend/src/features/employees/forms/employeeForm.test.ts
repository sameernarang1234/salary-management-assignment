import { asha } from '../../../test/fixtures';
import {
  detailsFromEmployee,
  validateEmployeeDetails,
  validateLeaving,
  validateSalaryChange,
} from './employeeForm';

const TODAY = '2026-06-30';

const valid = {
  fullName: 'Asha Verma',
  email: 'asha.verma@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  hireDate: '2023-04-01',
};

describe('validateEmployeeDetails', () => {
  it('accepts valid details', () => {
    expect(validateEmployeeDetails(valid, TODAY)).toEqual({});
  });

  it('requires every field', () => {
    expect(
      validateEmployeeDetails(
        { fullName: ' ', email: '', jobTitle: '', department: '', countryCode: '', hireDate: '' },
        TODAY,
      ),
    ).toEqual({
      fullName: 'Required',
      email: 'Required',
      jobTitle: 'Required',
      department: 'Required',
      countryCode: 'Choose a country',
      hireDate: 'Required',
    });
  });

  it('checks the email format', () => {
    expect(validateEmployeeDetails({ ...valid, email: 'asha@' }, TODAY).email).toBe(
      'Enter a valid email address',
    );
  });

  it('rejects impossible and future hire dates, and accepts today', () => {
    expect(validateEmployeeDetails({ ...valid, hireDate: '2025-02-30' }, TODAY).hireDate).toBe(
      'Enter a valid date',
    );
    expect(validateEmployeeDetails({ ...valid, hireDate: '2026-07-01' }, TODAY).hireDate).toBe(
      'Hire date cannot be in the future',
    );
    expect(validateEmployeeDetails({ ...valid, hireDate: TODAY }, TODAY)).toEqual({});
  });

  it('limits the length of names and titles', () => {
    expect(validateEmployeeDetails({ ...valid, fullName: 'a'.repeat(201) }, TODAY).fullName).toBe(
      'Must be at most 200 characters',
    );
    expect(validateEmployeeDetails({ ...valid, jobTitle: 'a'.repeat(101) }, TODAY).jobTitle).toBe(
      'Must be at most 100 characters',
    );
  });
});

describe('detailsFromEmployee', () => {
  it('fills the form from an employee', () => {
    expect(detailsFromEmployee(asha)).toEqual({
      fullName: 'Asha Verma',
      email: 'asha.verma@acme.example',
      jobTitle: 'Software Engineer',
      department: 'Engineering',
      countryCode: 'IN',
      hireDate: '2023-04-01',
    });
  });
});

describe('validateSalaryChange', () => {
  const context = { today: TODAY, hireDate: '2023-04-01' };

  it('accepts a reason and an effective date between the hire date and today', () => {
    expect(
      validateSalaryChange({ effectiveDate: '2026-04-01', reason: 'promotion' }, context),
    ).toEqual({});
  });

  it('requires a reason and a date', () => {
    expect(validateSalaryChange({ effectiveDate: '', reason: '' }, context)).toEqual({
      effectiveDate: 'Required',
      reason: 'Choose a reason',
    });
  });

  it('rejects a date in the future or before the hire date', () => {
    expect(
      validateSalaryChange({ effectiveDate: '2026-07-01', reason: 'other' }, context).effectiveDate,
    ).toBe('Effective date cannot be in the future');
    expect(
      validateSalaryChange({ effectiveDate: '2023-03-31', reason: 'other' }, context).effectiveDate,
    ).toBe('Effective date cannot be before the hire date');
  });
});

describe('validateLeaving', () => {
  const context = { today: TODAY, hireDate: '2023-04-01' };

  it('accepts a leaving date between the hire date and today', () => {
    expect(validateLeaving('2026-06-30', context)).toBeUndefined();
  });

  it.each([
    ['', 'Required'],
    ['2026-02-30', 'Enter a valid date'],
    ['2026-07-01', 'Leaving date cannot be in the future'],
    ['2023-03-01', 'Leaving date cannot be before the hire date'],
  ])('rejects "%s"', (leftOn, message) => {
    expect(validateLeaving(leftOn, context)).toBe(message);
  });
});
