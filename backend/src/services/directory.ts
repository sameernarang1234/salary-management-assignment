import { listCountries } from '../repositories/countries.js';
import {
  findEmployeeById,
  listEmployees,
  type EmployeeDetails,
  type EmployeeListQuery,
  type EmployeeSummary,
  type Page,
} from '../repositories/employees.js';
import { listSalaryHistory, type SalaryHistoryEntry } from '../repositories/salaryHistory.js';
import { toUsd } from '../validators/currency.js';
import type { ServiceContext } from './context.js';
import { EmployeeNotFoundError } from './errors.js';

export interface DirectoryEmployee extends EmployeeSummary {
  totalSalaryUsd: number;
}

export interface EmployeeView extends EmployeeDetails {
  totalSalaryUsd: number;
}

/** Adds the USD total to an employee's details, using their country's rate. */
export function withUsd(employee: EmployeeDetails): EmployeeView {
  return { ...employee, totalSalaryUsd: toUsd(employee.totalSalary, employee.usdPerUnit) };
}

/** The directory page, with each total also converted to USD for comparison. */
export async function listDirectory(
  context: ServiceContext,
  query: EmployeeListQuery,
): Promise<Page<DirectoryEmployee>> {
  const [page, countries] = await Promise.all([
    listEmployees(context.db, query),
    listCountries(context.db),
  ]);
  const rateByCountry = new Map(countries.map((country) => [country.code, country.usdPerUnit]));

  return {
    ...page,
    items: page.items.map((employee) => {
      const rate = rateByCountry.get(employee.countryCode);
      if (rate === undefined) {
        throw new Error(`No USD rate for country ${employee.countryCode}`);
      }
      return { ...employee, totalSalaryUsd: toUsd(employee.totalSalary, rate) };
    }),
  };
}

export async function getEmployee(context: ServiceContext, id: number): Promise<EmployeeView> {
  const employee = await findEmployeeById(context.db, id);
  if (!employee) {
    throw new EmployeeNotFoundError(id);
  }
  return withUsd(employee);
}

export async function getSalaryHistory(
  context: ServiceContext,
  id: number,
): Promise<SalaryHistoryEntry[]> {
  if (!(await findEmployeeById(context.db, id))) {
    throw new EmployeeNotFoundError(id);
  }
  return listSalaryHistory(context.db, id);
}
