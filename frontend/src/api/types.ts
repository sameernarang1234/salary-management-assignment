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

export type EmployeeStatus = 'active' | 'left';

/** A row in the directory. */
export interface EmployeeSummary {
  id: number;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  hireDate: string;
  status: EmployeeStatus;
  leftOn: string | null;
  currency: string;
  totalSalary: number;
  totalSalaryUsd: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Query parameters of GET /api/employees. */
export interface EmployeeListParams {
  search?: string;
  country?: string;
  department?: string;
  jobTitle?: string;
  sort?: EmployeeSortField;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  includeLeft?: 'true';
}

export interface SalaryComponent {
  code: SalaryComponentCode;
  annualAmount: number;
}

/** Everything the employee details page needs. */
export interface EmployeeDetails extends Omit<EmployeeSummary, 'totalSalaryUsd'> {
  countryName: string;
  usdPerUnit: string;
  salaryComponents: SalaryComponent[];
  totalSalaryUsd?: number;
}

export type SalaryHistoryReason = 'new_hire' | SalaryChangeReason;

export interface SalaryHistoryEntry {
  id: number;
  employeeId: number;
  effectiveDate: string;
  reason: SalaryHistoryReason;
  previousComponents: SalaryComponent[] | null;
  previousTotal: number | null;
  newComponents: SalaryComponent[];
  newTotal: number;
  recordedAt: string;
}

export interface EmployeeInput {
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  countryCode: string;
  hireDate: string;
}

export interface NewEmployeeInput extends EmployeeInput {
  components: SalaryComponent[];
}

export interface SalaryChangeInput {
  components: SalaryComponent[];
  effectiveDate: string;
  reason: SalaryChangeReason;
}

/** The backend's one error format. */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
