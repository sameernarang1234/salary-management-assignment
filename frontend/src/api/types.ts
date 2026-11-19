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

export type EmployeeSortField =
  'fullName' | 'jobTitle' | 'department' | 'country' | 'hireDate' | 'salary';

/** Which employees the directory shows: current, former (left), or everyone. */
export type EmployeeStatusFilter = 'active' | 'left' | 'all';

export interface Meta {
  countries: Country[];
  salaryComponents: SalaryComponentType[];
  salaryChangeReasons: SalaryChangeReason[];
  sortFields: EmployeeSortField[];
  employeeStatuses: EmployeeStatusFilter[];
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
  /** Sent as repeated parameters (?country=IN&country=US); any of them matches. */
  country?: string[];
  department?: string[];
  jobTitle?: string[];
  status?: EmployeeStatusFilter;
  sort?: EmployeeSortField;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
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

export interface SalaryBand {
  label: string;
  minUsd: number;
  /** null for the top band */
  maxUsd: number | null;
  headcount: number;
}

export interface InsightsOverview {
  headcount: number;
  totalPayrollUsd: number;
  /** null when there are no active employees */
  medianSalaryUsd: number | null;
  salaryDistribution: SalaryBand[];
}

export interface PayStats {
  headcount: number;
  min: number;
  median: number;
  average: number;
  max: number;
}

export interface CountryPay extends PayStats {
  countryCode: string;
  countryName: string;
  currency: string;
  averageUsd: number;
  totalUsd: number;
}

export interface JobTitlePay extends PayStats {
  jobTitle: string;
}

export interface CountryJobTitlePay {
  countryCode: string;
  countryName: string;
  currency: string;
  jobTitles: JobTitlePay[];
}

export interface DepartmentCost {
  department: string;
  headcount: number;
  totalUsd: number;
  averageUsd: number;
}

/** The backend's one error format. */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
