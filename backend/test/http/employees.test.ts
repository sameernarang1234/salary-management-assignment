import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { insertTestCountries, resetDatabase, testPrisma } from '../helpers/database.js';
import { signIn, testApp } from '../helpers/http.js';

const app = testApp();
let cookie: string;

const asha = {
  fullName: 'Asha Verma',
  email: 'asha.verma@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  hireDate: '2023-04-01',
  components: [
    { code: 'BASIC', annualAmount: 1_200_000 },
    { code: 'HRA', annualAmount: 480_000 },
  ],
};

const john = {
  ...asha,
  fullName: 'John Smith',
  email: 'john.smith@acme.example',
  countryCode: 'US',
  hireDate: '2022-01-10',
  components: [{ code: 'BASIC', annualAmount: 120_000 }],
};

const api = {
  get: (path: string) => request(app).get(path).set('Cookie', cookie),
  post: (path: string, body?: object) => request(app).post(path).set('Cookie', cookie).send(body),
  put: (path: string, body: object) => request(app).put(path).set('Cookie', cookie).send(body),
};

async function create(employee: object): Promise<number> {
  const response = await api.post('/api/employees', employee);
  expect(response.status).toBe(201);
  return response.body.id as number;
}

beforeEach(async () => {
  await resetDatabase();
  await insertTestCountries();
  cookie = await signIn();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('POST /api/employees', () => {
  it('creates the employee and returns 201 with their details and USD total', async () => {
    const response = await api.post('/api/employees', asha);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      fullName: 'Asha Verma',
      currency: 'INR',
      salaryComponents: asha.components,
      totalSalary: 1_680_000,
      totalSalaryUsd: 20_160,
    });
  });

  it('returns 400 with errors per field', async () => {
    const response = await api.post('/api/employees', {
      ...asha,
      email: 'nope',
      components: [{ code: 'HRA', annualAmount: 0 }],
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        fields: {
          email: 'Enter a valid email address',
          'components.0.annualAmount': 'Must be a whole number greater than 0',
          components: 'Basic is required',
        },
      },
    });
  });

  it('returns 400 for an unknown country', async () => {
    const response = await api.post('/api/employees', { ...asha, countryCode: 'ZZ' });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toEqual({ countryCode: 'Unknown country' });
  });

  it('returns 409 for a duplicate email, with the field', async () => {
    await create(asha);

    const response = await api.post('/api/employees', {
      ...asha,
      email: 'ASHA.VERMA@acme.example',
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: 'EMAIL_IN_USE',
      fields: { email: 'This email is already used by another employee' },
    });
  });
});

describe('GET /api/employees', () => {
  it('returns a page of the directory with totals in local currency and USD', async () => {
    await create(asha);
    await create(john);

    const response = await api.get('/api/employees');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2, page: 1, pageSize: 25 });
    expect(response.body.items).toEqual([
      expect.objectContaining({
        fullName: 'Asha Verma',
        currency: 'INR',
        totalSalary: 1_680_000,
        totalSalaryUsd: 20_160,
      }),
      expect.objectContaining({
        fullName: 'John Smith',
        currency: 'USD',
        totalSalary: 120_000,
        totalSalaryUsd: 120_000,
      }),
    ]);
  });

  it('applies search, filters, sorting and paging from the query string', async () => {
    await create(asha);
    await create(john);

    const response = await api.get(
      '/api/employees?search=smi&country=US&department=Engineering&jobTitle=Software%20Engineer&sort=hireDate&order=desc&page=1&pageSize=10',
    );

    expect(response.body.items.map((e: { fullName: string }) => e.fullName)).toEqual([
      'John Smith',
    ]);
  });

  it('includes leavers only when asked', async () => {
    const id = await create(asha);
    await api.post(`/api/employees/${id}/leave`, { leftOn: '2026-06-01' });

    expect((await api.get('/api/employees')).body.total).toBe(0);
    expect((await api.get('/api/employees?includeLeft=true')).body.total).toBe(1);
  });

  it.each([
    ['page=0', 'page'],
    ['pageSize=101', 'pageSize'],
    ['sort=salary', 'sort'],
    ['order=up', 'order'],
    ['includeLeft=maybe', 'includeLeft'],
    ['country=IN&country=US', 'country'],
  ])('returns 400 for the invalid query %s', async (query, field) => {
    const response = await api.get(`/api/employees?${query}`);

    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.fields)).toEqual([field]);
  });
});

describe('GET /api/employees/export', () => {
  it('downloads the filtered directory as CSV, named with today’s date', async () => {
    await create(asha);
    await create(john);

    const response = await api.get('/api/employees/export?country=IN');

    expect(response.status).toBe(200);
    expect(response.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.get('Content-Disposition')).toBe(
      'attachment; filename=employees-2026-06-30.csv',
    );
    const lines = response.text.replace('\uFEFF', '').trim().split('\r\n');
    expect(lines).toEqual([
      'ID,Full name,Email,Job title,Department,Country,Currency,Hire date,Status,Left on,Total annual salary,Total annual salary (USD)',
      expect.stringMatching(
        /^\d+,Asha Verma,asha\.verma@acme\.example,Software Engineer,Engineering,IN,INR,2023-04-01,active,,1680000,20160$/,
      ),
    ]);
  });

  it('neutralises spreadsheet formulas in names', async () => {
    await create({ ...asha, fullName: '=HYPERLINK("http://evil.example")' });

    const response = await api.get('/api/employees/export');

    expect(response.text).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
  });

  it('returns only the header row when nothing matches', async () => {
    const response = await api.get('/api/employees/export?search=nobody');

    expect(response.text.replace('\uFEFF', '').trim().split('\r\n')).toHaveLength(1);
  });
});

describe('GET /api/employees/:id', () => {
  it('returns the employee’s details with the USD total', async () => {
    const id = await create(asha);

    const response = await api.get(`/api/employees/${id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id,
      countryName: 'India',
      usdPerUnit: '0.012',
      totalSalaryUsd: 20_160,
    });
  });

  it('returns 404 for an unknown employee', async () => {
    const response = await api.get('/api/employees/999999');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });

  it.each(['abc', '0', '-1', '1.5'])('returns 400 for the id %s', async (id) => {
    const response = await api.get(`/api/employees/${id}`);

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toHaveProperty('id');
  });
});

describe('PUT /api/employees/:id', () => {
  it('updates the details and returns the full employee', async () => {
    const id = await create(asha);

    const response = await api.put(`/api/employees/${id}`, {
      ...asha,
      jobTitle: 'Senior Software Engineer',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobTitle: 'Senior Software Engineer',
      totalSalary: 1_680_000,
    });
  });

  it('returns 404 for an unknown employee', async () => {
    expect((await api.put('/api/employees/999999', asha)).status).toBe(404);
  });

  it('returns 409 when taking another employee’s email', async () => {
    await create(asha);
    const id = await create(john);

    expect((await api.put(`/api/employees/${id}`, asha)).status).toBe(409);
  });
});

describe('POST /api/employees/:id/salary', () => {
  const raise = {
    components: [
      { code: 'BASIC', annualAmount: 1_320_000 },
      { code: 'HRA', annualAmount: 480_000 },
    ],
    effectiveDate: '2026-04-01',
    reason: 'annual_increment',
  };

  it('changes the salary and returns 201 with the employee and the history entry', async () => {
    const id = await create(asha);

    const response = await api.post(`/api/employees/${id}/salary`, raise);

    expect(response.status).toBe(201);
    expect(response.body.employee).toMatchObject({
      totalSalary: 1_800_000,
      totalSalaryUsd: 21_600,
    });
    expect(response.body.historyEntry).toMatchObject({
      reason: 'annual_increment',
      previousTotal: 1_680_000,
      newTotal: 1_800_000,
    });
  });

  it('returns 400 for an unchanged salary', async () => {
    const id = await create(asha);

    const response = await api.post(`/api/employees/${id}/salary`, {
      ...raise,
      components: asha.components,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toEqual({
      components: 'The new salary is the same as the current salary',
    });
  });

  it('returns 409 for an employee who has left', async () => {
    const id = await create(asha);
    await api.post(`/api/employees/${id}/leave`, { leftOn: '2026-06-01' });

    const response = await api.post(`/api/employees/${id}/salary`, raise);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMPLOYEE_LEFT');
  });

  it('returns 404 for an unknown employee', async () => {
    expect((await api.post('/api/employees/999999/salary', raise)).status).toBe(404);
  });
});

describe('GET /api/employees/:id/history', () => {
  it('returns the salary history, newest first', async () => {
    const id = await create(asha);
    await api.post(`/api/employees/${id}/salary`, {
      components: [{ code: 'BASIC', annualAmount: 2_000_000 }],
      effectiveDate: '2025-04-01',
      reason: 'promotion',
    });

    const response = await api.get(`/api/employees/${id}/history`);

    expect(response.status).toBe(200);
    expect(response.body.items.map((entry: { reason: string }) => entry.reason)).toEqual([
      'promotion',
      'new_hire',
    ]);
  });

  it('returns 404 for an unknown employee', async () => {
    expect((await api.get('/api/employees/999999/history')).status).toBe(404);
  });
});

describe('POST /api/employees/:id/leave', () => {
  it('marks the employee as left', async () => {
    const id = await create(asha);

    const response = await api.post(`/api/employees/${id}/leave`, { leftOn: '2026-06-01' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'left', leftOn: '2026-06-01' });
  });

  it('returns 409 when the employee has already left', async () => {
    const id = await create(asha);
    await api.post(`/api/employees/${id}/leave`, { leftOn: '2026-06-01' });

    expect((await api.post(`/api/employees/${id}/leave`, { leftOn: '2026-06-02' })).status).toBe(
      409,
    );
  });

  it('returns 400 for a missing leaving date', async () => {
    const id = await create(asha);

    const response = await api.post(`/api/employees/${id}/leave`, {});

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toHaveProperty('leftOn');
  });
});
