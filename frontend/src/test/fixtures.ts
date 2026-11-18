import type { EmployeeSummary, Meta, Page } from '../api/types';

export const testMeta: Meta = {
  countries: [
    { code: 'IN', name: 'India', currency: 'INR', usdPerUnit: '0.012' },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', usdPerUnit: '1.27' },
    { code: 'US', name: 'United States', currency: 'USD', usdPerUnit: '1' },
  ],
  salaryComponents: [
    { code: 'BASIC', name: 'Basic', required: true },
    { code: 'HRA', name: 'House Rent Allowance', required: false },
    { code: 'HOUSING', name: 'Housing Allowance', required: false },
    { code: 'TRANSPORT', name: 'Transport Allowance', required: false },
    { code: 'SPECIAL', name: 'Special Allowance', required: false },
  ],
  salaryChangeReasons: ['annual_increment', 'promotion', 'correction', 'other'],
  sortFields: ['fullName', 'jobTitle', 'department', 'country', 'hireDate'],
  filterOptions: {
    departments: ['Engineering', 'Sales'],
    jobTitles: ['Account Executive', 'Software Engineer'],
  },
  ratesAsOf: '2026-01-01',
};

export const asha: EmployeeSummary = {
  id: 1,
  fullName: 'Asha Verma',
  email: 'asha.verma@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  hireDate: '2023-04-01',
  status: 'active',
  leftOn: null,
  currency: 'INR',
  totalSalary: 1_680_000,
  totalSalaryUsd: 20_160,
};

export const john: EmployeeSummary = {
  id: 2,
  fullName: 'John Smith',
  email: 'john.smith@acme.example',
  jobTitle: 'Account Executive',
  department: 'Sales',
  countryCode: 'US',
  hireDate: '2022-01-10',
  status: 'active',
  leftOn: null,
  currency: 'USD',
  totalSalary: 120_000,
  totalSalaryUsd: 120_000,
};

export function pageOf(
  items: EmployeeSummary[],
  { total = items.length, page = 1, pageSize = 25 } = {},
): Page<EmployeeSummary> {
  return { items, total, page, pageSize };
}
