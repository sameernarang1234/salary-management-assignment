import type {
  EmployeeDetails,
  EmployeeSummary,
  Meta,
  Page,
  SalaryHistoryEntry,
} from '../api/types';

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

export const ashaDetails: EmployeeDetails = {
  ...asha,
  countryName: 'India',
  usdPerUnit: '0.012',
  salaryComponents: [
    { code: 'BASIC', annualAmount: 1_200_000 },
    { code: 'HRA', annualAmount: 480_000 },
  ],
};

export const ashaHistory: SalaryHistoryEntry[] = [
  {
    id: 2,
    employeeId: 1,
    effectiveDate: '2025-04-01',
    reason: 'promotion',
    previousComponents: [{ code: 'BASIC', annualAmount: 1_400_000 }],
    previousTotal: 1_400_000,
    newComponents: ashaDetails.salaryComponents,
    newTotal: 1_680_000,
    recordedAt: '2025-03-20T10:15:00.000Z',
  },
  {
    id: 1,
    employeeId: 1,
    effectiveDate: '2023-04-01',
    reason: 'new_hire',
    previousComponents: null,
    previousTotal: null,
    newComponents: [{ code: 'BASIC', annualAmount: 1_400_000 }],
    newTotal: 1_400_000,
    recordedAt: '2023-03-25T09:00:00.000Z',
  },
];

export function pageOf(
  items: EmployeeSummary[],
  { total = items.length, page = 1, pageSize = 25 } = {},
): Page<EmployeeSummary> {
  return { items, total, page, pageSize };
}
