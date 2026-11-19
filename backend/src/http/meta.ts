import { Router } from 'express';
import { RATES_AS_OF } from '../referenceData/countries.js';
import { listCountries } from '../repositories/countries.js';
import { EMPLOYEE_SORT_FIELDS, EMPLOYEE_STATUSES } from '../repositories/employees.js';
import { getFilterOptions } from '../repositories/filterOptions.js';
import { SALARY_CHANGE_REASONS } from '../validators/salaryChange.js';
import { SALARY_COMPONENT_CATALOGUE } from '../validators/salaryComponents.js';
import type { AppDependencies } from './dependencies.js';

/** Reference data the frontend needs for its forms and filters, in one request. */
export function metaRouter(dependencies: AppDependencies): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    const [countries, filterOptions] = await Promise.all([
      listCountries(dependencies.db),
      getFilterOptions(dependencies.db),
    ]);
    response.json({
      countries,
      salaryComponents: SALARY_COMPONENT_CATALOGUE,
      salaryChangeReasons: SALARY_CHANGE_REASONS,
      sortFields: EMPLOYEE_SORT_FIELDS,
      employeeStatuses: EMPLOYEE_STATUSES,
      filterOptions,
      ratesAsOf: RATES_AS_OF,
    });
  });

  return router;
}
