import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { RATES_AS_OF } from '../../src/referenceData/countries.js';
import { insertTestCountries, resetDatabase, testPrisma } from '../helpers/database.js';
import { signIn, testApp } from '../helpers/http.js';

const app = testApp();
let cookie: string;

const get = (path: string) => request(app).get(path).set('Cookie', cookie);

async function hire(email: string, countryCode: string, jobTitle: string, basic: number) {
  const response = await request(app)
    .post('/api/employees')
    .set('Cookie', cookie)
    .send({
      fullName: email,
      email,
      jobTitle,
      department: 'Engineering',
      countryCode,
      hireDate: '2024-01-15',
      components: [{ code: 'BASIC', annualAmount: basic }],
    });
  expect(response.status).toBe(201);
}

beforeEach(async () => {
  await resetDatabase();
  await insertTestCountries();
  cookie = await signIn();
  await hire('a@acme.example', 'IN', 'Software Engineer', 1_200_000);
  await hire('b@acme.example', 'IN', 'Software Engineer', 1_800_000);
  await hire('c@acme.example', 'US', 'Designer', 100_000);
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('insights endpoints', () => {
  it('GET /api/insights/overview returns headcount, payroll, median and distribution', async () => {
    const response = await get('/api/insights/overview');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      headcount: 3,
      totalPayrollUsd: 136_000, // 14,400 + 21,600 + 100,000
      medianSalaryUsd: 21_600,
    });
    expect(response.body.salaryDistribution).toHaveLength(8);
  });

  it('GET /api/insights/countries returns pay per country', async () => {
    const response = await get('/api/insights/countries');

    expect(response.status).toBe(200);
    expect(response.body.items.map((row: { countryCode: string }) => row.countryCode)).toEqual([
      'US',
      'IN',
    ]);
  });

  it('GET /api/insights/countries/:code/job-titles returns pay per job title', async () => {
    const response = await get('/api/insights/countries/IN/job-titles');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      countryCode: 'IN',
      currency: 'INR',
      jobTitles: [{ jobTitle: 'Software Engineer', headcount: 2, median: 1_500_000 }],
    });
  });

  it('accepts a lower-case country code', async () => {
    expect((await get('/api/insights/countries/in/job-titles')).body.countryCode).toBe('IN');
  });

  it('returns 400 for an unknown country', async () => {
    const response = await get('/api/insights/countries/ZZ/job-titles');

    expect(response.status).toBe(400);
    expect(response.body.error.fields).toEqual({ countryCode: 'Unknown country' });
  });

  it('GET /api/insights/departments returns cost per department', async () => {
    const response = await get('/api/insights/departments');

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      { department: 'Engineering', headcount: 3, totalUsd: 136_000, averageUsd: 45_333 },
    ]);
  });
});

describe('GET /api/meta', () => {
  it('returns reference data for the forms and filters', async () => {
    const response = await get('/api/meta');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
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
      sortFields: ['fullName', 'jobTitle', 'department', 'country', 'hireDate', 'salary'],
      employeeStatuses: ['active', 'left', 'all'],
      filterOptions: { departments: ['Engineering'], jobTitles: ['Designer', 'Software Engineer'] },
      ratesAsOf: RATES_AS_OF,
    });
  });
});
