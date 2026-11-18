import { Router } from 'express';
import { z } from 'zod';
import { EMPLOYEE_SORT_FIELDS, type EmployeeListQuery } from '../repositories/employees.js';
import { parse } from '../services/context.js';
import { getEmployee, getSalaryHistory, listDirectory, withUsd } from '../services/directory.js';
import {
  changeSalary,
  createEmployee,
  markEmployeeLeft,
  updateEmployeeDetails,
} from '../services/employees.js';
import { toCsv } from './csv.js';
import type { AppDependencies } from './dependencies.js';

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 50_000;

const filtersShape = {
  search: z.string().optional(),
  country: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  sort: z.enum(EMPLOYEE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  includeLeft: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
};

const listQuerySchema = z.object({
  ...filtersShape,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

const exportQuerySchema = z.object(filtersShape);

const idParamsSchema = z.object({
  id: z.coerce.number({ error: 'Must be a positive whole number' }).int().positive(),
});

type Filters = z.output<typeof exportQuerySchema>;

function toListQuery(
  { country, ...filters }: Filters,
  page: number,
  pageSize: number,
): EmployeeListQuery {
  return { ...filters, countryCode: country, page, pageSize };
}

const CSV_HEADERS = [
  'ID',
  'Full name',
  'Email',
  'Job title',
  'Department',
  'Country',
  'Currency',
  'Hire date',
  'Status',
  'Left on',
  'Total annual salary',
  'Total annual salary (USD)',
];

export function employeesRouter(dependencies: AppDependencies): Router {
  const router = Router();
  const idFrom = (params: unknown) => parse(idParamsSchema, params).id;

  router.get('/', async (request, response) => {
    const query = parse(listQuerySchema, request.query);
    response.json(
      await listDirectory(dependencies, toListQuery(query, query.page, query.pageSize)),
    );
  });

  router.post('/', async (request, response) => {
    const employee = await createEmployee(dependencies, request.body);
    response.status(201).json(withUsd(employee));
  });

  // Registered before "/:id" so "export" is not read as an id.
  router.get('/export', async (request, response) => {
    const filters = parse(exportQuerySchema, request.query);
    const { items } = await listDirectory(dependencies, toListQuery(filters, 1, MAX_EXPORT_ROWS));
    const rows = items.map((employee) => [
      employee.id,
      employee.fullName,
      employee.email,
      employee.jobTitle,
      employee.department,
      employee.countryCode,
      employee.currency,
      employee.hireDate,
      employee.status,
      employee.leftOn,
      employee.totalSalary,
      employee.totalSalaryUsd,
    ]);
    response
      .type('text/csv; charset=utf-8')
      .attachment(`employees-${dependencies.clock.today()}.csv`)
      .send(toCsv(CSV_HEADERS, rows));
  });

  router.get('/:id', async (request, response) => {
    response.json(await getEmployee(dependencies, idFrom(request.params)));
  });

  router.put('/:id', async (request, response) => {
    const id = idFrom(request.params);
    await updateEmployeeDetails(dependencies, id, request.body);
    response.json(await getEmployee(dependencies, id));
  });

  router.post('/:id/salary', async (request, response) => {
    const result = await changeSalary(dependencies, idFrom(request.params), request.body);
    response
      .status(201)
      .json({ employee: withUsd(result.employee), historyEntry: result.historyEntry });
  });

  router.get('/:id/history', async (request, response) => {
    response.json({ items: await getSalaryHistory(dependencies, idFrom(request.params)) });
  });

  router.post('/:id/leave', async (request, response) => {
    response.json(await markEmployeeLeft(dependencies, idFrom(request.params), request.body));
  });

  return router;
}
