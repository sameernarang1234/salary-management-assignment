/** Shapes of the backend API's responses (see backend/src/http). */

export interface SignedInUser {
  email: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  /** Decimal string, e.g. "0.012". */
  usdPerUnit: string;
}

export type SalaryComponentCode = 'BASIC' | 'HRA' | 'HOUSING' | 'TRANSPORT' | 'SPECIAL';

export interface SalaryComponentType {
  code: SalaryComponentCode;
  name: string;
  required: boolean;
}

export type SalaryChangeReason = 'annual_increment' | 'promotion' | 'correction' | 'other';

export type EmployeeSortField = 'fullName' | 'jobTitle' | 'department' | 'country' | 'hireDate';

export interface Meta {
  countries: Country[];
  salaryComponents: SalaryComponentType[];
  salaryChangeReasons: SalaryChangeReason[];
  sortFields: EmployeeSortField[];
  filterOptions: { departments: string[]; jobTitles: string[] };
  ratesAsOf: string;
}

/** The backend's one error format. */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
