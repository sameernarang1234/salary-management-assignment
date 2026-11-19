import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { EmailInUseError } from '../../src/repositories/errors.js';
import {
  findEmployeeById,
  insertEmployee,
  listEmployees,
  markEmployeeLeft,
  updateEmployeeDetails,
  type EmployeeListQuery,
} from '../../src/repositories/employees.js';
import { replaceSalaryComponents } from '../../src/repositories/salaryComponents.js';
import type { EmployeeInput } from '../../src/validators/employee.js';
import { insertTestCountries, resetDatabase, testPrisma } from '../helpers/database.js';

const people: EmployeeInput[] = [
  {
    fullName: 'Asha Verma',
    email: 'asha.verma@acme.example',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    hireDate: '2023-04-01',
  },
  {
    fullName: 'Rahul Mehta',
    email: 'rahul.mehta@acme.example',
    jobTitle: 'Product Manager',
    department: 'Product',
    countryCode: 'IN',
    hireDate: '2021-06-15',
  },
  {
    fullName: 'John Smith',
    email: 'john.smith@acme.example',
    jobTitle: 'Software Engineer',
    department: 'Engineering',
    countryCode: 'US',
    hireDate: '2022-01-10',
  },
  {
    fullName: 'Emma Brown',
    email: 'emma_b@acme.example',
    jobTitle: 'Designer',
    department: 'Design',
    countryCode: 'GB',
    hireDate: '2020-09-01',
  },
  {
    fullName: 'Carlos Diaz',
    email: 'carlos.diaz@acme.example',
    jobTitle: 'Data Analyst',
    department: 'Finance',
    countryCode: 'US',
    hireDate: '2024-02-20',
  },
];

const leaver: EmployeeInput = {
  fullName: 'Olivia Left',
  email: 'olivia.left@acme.example',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  countryCode: 'GB',
  hireDate: '2019-03-01',
};

const query = (overrides: Partial<EmployeeListQuery> = {}): EmployeeListQuery => ({
  page: 1,
  pageSize: 50,
  ...overrides,
});

const names = async (overrides: Partial<EmployeeListQuery> = {}) =>
  (await listEmployees(testPrisma, query(overrides))).items.map((employee) => employee.fullName);

beforeEach(async () => {
  await resetDatabase();
  await insertTestCountries();
  for (const person of people) {
    await insertEmployee(testPrisma, person);
  }
  const left = await insertEmployee(testPrisma, leaver);
  await markEmployeeLeft(testPrisma, left.id, '2025-01-31');
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('insertEmployee', () => {
  it('returns the new employee as a plain object with dates as YYYY-MM-DD', async () => {
    const employee = await insertEmployee(testPrisma, {
      ...people[0]!,
      email: 'new.person@acme.example',
    });

    expect(employee).toEqual({
      id: expect.any(Number),
      ...people[0],
      email: 'new.person@acme.example',
      status: 'active',
      leftOn: null,
    });
  });

  it('raises EmailInUseError for an email that differs only in case', async () => {
    await expect(
      insertEmployee(testPrisma, { ...people[1]!, email: 'ASHA.Verma@ACME.example' }),
    ).rejects.toThrow(EmailInUseError);
  });
});

describe('findEmployeeById', () => {
  it('returns details with current components, total and the country currency', async () => {
    const asha = (await listEmployees(testPrisma, query({ search: 'asha' }))).items[0]!;
    await replaceSalaryComponents(testPrisma, asha.id, [
      { code: 'HRA', annualAmount: 480_000 },
      { code: 'BASIC', annualAmount: 1_200_000 },
    ]);

    expect(await findEmployeeById(testPrisma, asha.id)).toEqual({
      id: asha.id,
      ...people[0],
      status: 'active',
      leftOn: null,
      countryName: 'India',
      currency: 'INR',
      usdPerUnit: '0.012',
      salaryComponents: [
        { code: 'BASIC', annualAmount: 1_200_000 },
        { code: 'HRA', annualAmount: 480_000 },
      ],
      totalSalary: 1_680_000,
    });
  });

  it('returns null for an unknown id', async () => {
    expect(await findEmployeeById(testPrisma, 999_999)).toBeNull();
  });
});

describe('updateEmployeeDetails', () => {
  it('changes the details', async () => {
    const asha = (await listEmployees(testPrisma, query({ search: 'asha' }))).items[0]!;

    const updated = await updateEmployeeDetails(testPrisma, asha.id, {
      ...people[0]!,
      jobTitle: 'Senior Software Engineer',
      countryCode: 'GB',
    });

    expect(updated).toMatchObject({ jobTitle: 'Senior Software Engineer', countryCode: 'GB' });
  });

  it('raises EmailInUseError when taking another employee’s email', async () => {
    const asha = (await listEmployees(testPrisma, query({ search: 'asha' }))).items[0]!;

    await expect(
      updateEmployeeDetails(testPrisma, asha.id, {
        ...people[0]!,
        email: 'RAHUL.MEHTA@acme.example',
      }),
    ).rejects.toThrow(EmailInUseError);
  });

  it('returns null for an unknown id', async () => {
    expect(await updateEmployeeDetails(testPrisma, 999_999, people[0]!)).toBeNull();
  });
});

describe('markEmployeeLeft', () => {
  it('sets status left and the leaving date', async () => {
    const asha = (await listEmployees(testPrisma, query({ search: 'asha' }))).items[0]!;

    expect(await markEmployeeLeft(testPrisma, asha.id, '2026-03-31')).toMatchObject({
      status: 'left',
      leftOn: '2026-03-31',
    });
  });

  it('returns null for an unknown id', async () => {
    expect(await markEmployeeLeft(testPrisma, 999_999, '2026-03-31')).toBeNull();
  });
});

describe('listEmployees', () => {
  describe('search', () => {
    it('matches part of a name in any case', async () => {
      expect(await names({ search: 'SMI' })).toEqual(['John Smith']);
    });

    it('matches part of an email in any case', async () => {
      expect(await names({ search: 'Mehta@ACME' })).toEqual(['Rahul Mehta']);
    });

    it('treats % as a literal character', async () => {
      expect(await names({ search: '%' })).toEqual([]);
    });

    it('treats _ as a literal character', async () => {
      // As a LIKE wildcard, "a_v" would match "asha.verma".
      expect(await names({ search: 'a_v' })).toEqual([]);
      expect(await names({ search: 'emma_b' })).toEqual(['Emma Brown']);
    });

    it('treats a backslash as a literal character', async () => {
      expect(await names({ search: '\\' })).toEqual([]);
    });

    it('ignores surrounding spaces and treats a blank search as no search', async () => {
      expect(await names({ search: '  smith ' })).toEqual(['John Smith']);
      expect(await names({ search: '   ' })).toHaveLength(5);
    });
  });

  describe('SQL injection attempts', () => {
    it.each(["' OR 1=1 --", "'; DROP TABLE employees; --", 'x" OR "1"="1'])(
      'returns no rows for the search %s',
      async (search) => {
        const page = await listEmployees(testPrisma, query({ search }));

        expect(page).toMatchObject({ items: [], total: 0 });
        expect(await testPrisma.employee.count()).toBe(6);
      },
    );

    it('returns no rows for injection text in filters', async () => {
      expect(await names({ departments: ["Engineering' OR '1'='1"] })).toEqual([]);
      expect(await names({ countryCodes: ["IN' OR '1'='1"] })).toEqual([]);
      expect(await names({ jobTitles: ["x' OR 1=1 --"] })).toEqual([]);
    });
  });

  describe('filters', () => {
    it('filters by country', async () => {
      expect(await names({ countryCodes: ['US'] })).toEqual(['Carlos Diaz', 'John Smith']);
    });

    it('filters by department', async () => {
      expect(await names({ departments: ['Engineering'] })).toEqual(['Asha Verma', 'John Smith']);
    });

    it('filters by job title', async () => {
      expect(await names({ jobTitles: ['Designer'] })).toEqual(['Emma Brown']);
    });

    it('combines filters and search', async () => {
      expect(await names({ departments: ['Engineering'], countryCodes: ['IN'] })).toEqual([
        'Asha Verma',
      ]);
      expect(await names({ jobTitles: ['Software Engineer'], search: 'john' })).toEqual([
        'John Smith',
      ]);
      expect(await names({ countryCodes: ['GB'], departments: ['Engineering'] })).toEqual([]);
    });

    it('matches any of several countries', async () => {
      expect(await names({ countryCodes: ['GB', 'US'] })).toEqual([
        'Carlos Diaz',
        'Emma Brown',
        'John Smith',
      ]);
    });

    it('matches any of several departments and job titles', async () => {
      expect(await names({ departments: ['Design', 'Finance'] })).toEqual([
        'Carlos Diaz',
        'Emma Brown',
      ]);
      expect(await names({ jobTitles: ['Designer', 'Product Manager'] })).toEqual([
        'Emma Brown',
        'Rahul Mehta',
      ]);
    });

    it('combines several values in one filter with another filter', async () => {
      expect(await names({ countryCodes: ['IN', 'US'], departments: ['Engineering'] })).toEqual([
        'Asha Verma',
        'John Smith',
      ]);
    });

    it('treats an empty list as no filter', async () => {
      expect(await names({ countryCodes: [], departments: [], jobTitles: [] })).toHaveLength(5);
    });
  });

  describe('sorting', () => {
    it('sorts by name ascending by default', async () => {
      expect(await names()).toEqual([
        'Asha Verma',
        'Carlos Diaz',
        'Emma Brown',
        'John Smith',
        'Rahul Mehta',
      ]);
    });

    it('sorts by name descending', async () => {
      expect(await names({ sort: 'fullName', order: 'desc' })).toEqual([
        'Rahul Mehta',
        'John Smith',
        'Emma Brown',
        'Carlos Diaz',
        'Asha Verma',
      ]);
    });

    it('sorts by job title, ordering ties by id', async () => {
      expect(await names({ sort: 'jobTitle' })).toEqual([
        'Carlos Diaz', // Data Analyst
        'Emma Brown', // Designer
        'Rahul Mehta', // Product Manager
        'Asha Verma', // Software Engineer, id 1
        'John Smith', // Software Engineer, id 3
      ]);
    });

    it('orders ties by id even when sorting descending', async () => {
      expect(await names({ sort: 'jobTitle', order: 'desc' })).toEqual([
        'Asha Verma',
        'John Smith',
        'Rahul Mehta',
        'Emma Brown',
        'Carlos Diaz',
      ]);
    });

    it('sorts by department', async () => {
      expect(await names({ sort: 'department' })).toEqual([
        'Emma Brown', // Design
        'Asha Verma', // Engineering
        'John Smith', // Engineering
        'Carlos Diaz', // Finance
        'Rahul Mehta', // Product
      ]);
    });

    it('sorts by country name', async () => {
      expect(await names({ sort: 'country' })).toEqual([
        'Asha Verma', // India
        'Rahul Mehta', // India
        'Emma Brown', // United Kingdom
        'John Smith', // United States
        'Carlos Diaz', // United States
      ]);
    });

    it('sorts by hire date, newest first', async () => {
      expect(await names({ sort: 'hireDate', order: 'desc' })).toEqual([
        'Carlos Diaz', // 2024-02-20
        'Asha Verma', // 2023-04-01
        'John Smith', // 2022-01-10
        'Rahul Mehta', // 2021-06-15
        'Emma Brown', // 2020-09-01
      ]);
    });

    describe('by salary', () => {
      // Local amounts and their USD value (IN 0.012, GB 1.27, US 1). In local units Asha's
      // rupees are the biggest number, so a sort by local amount would put her last.
      beforeEach(async () => {
        const salaries: Record<string, number> = {
          'asha.verma@acme.example': 1_200_000, // ₹ → $14,400
          'rahul.mehta@acme.example': 2_500_000, // ₹ → $30,000
          'emma_b@acme.example': 60_000, // £ → $76,200
          'carlos.diaz@acme.example': 80_000, // $ → $80,000
          'john.smith@acme.example': 120_000, // $ → $120,000
        };
        const { items } = await listEmployees(testPrisma, query());
        for (const employee of items) {
          await replaceSalaryComponents(testPrisma, employee.id, [
            { code: 'BASIC', annualAmount: salaries[employee.email]! },
          ]);
        }
      });

      it('sorts by the total in USD, lowest first', async () => {
        expect(await names({ sort: 'salary' })).toEqual([
          'Asha Verma',
          'Rahul Mehta',
          'Emma Brown',
          'Carlos Diaz',
          'John Smith',
        ]);
      });

      it('sorts by the total in USD, highest first', async () => {
        expect(await names({ sort: 'salary', order: 'desc' })).toEqual([
          'John Smith',
          'Carlos Diaz',
          'Emma Brown',
          'Rahul Mehta',
          'Asha Verma',
        ]);
      });

      it('includes every component in the total it sorts by', async () => {
        const asha = (await listEmployees(testPrisma, query({ search: 'asha' }))).items[0]!;
        await replaceSalaryComponents(testPrisma, asha.id, [
          { code: 'BASIC', annualAmount: 1_200_000 },
          { code: 'SPECIAL', annualAmount: 9_000_000 }, // total ₹1,02,00,000 → $122,400
        ]);

        expect((await names({ sort: 'salary', order: 'desc' }))[0]).toBe('Asha Verma');
      });

      it('pages through salary order without repeating or skipping anyone', async () => {
        const first = await names({ sort: 'salary', pageSize: 2, page: 1 });
        const second = await names({ sort: 'salary', pageSize: 2, page: 2 });
        const third = await names({ sort: 'salary', pageSize: 2, page: 3 });

        expect([...first, ...second, ...third]).toEqual(await names({ sort: 'salary' }));
      });
    });
  });

  describe('paging', () => {
    it('returns the requested page and the total count', async () => {
      const page = await listEmployees(testPrisma, query({ page: 2, pageSize: 2 }));

      expect(page.items.map((employee) => employee.fullName)).toEqual(['Emma Brown', 'John Smith']);
      expect(page).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    });

    it('returns no items but the correct total for a page beyond the end', async () => {
      const page = await listEmployees(testPrisma, query({ page: 10, pageSize: 2 }));

      expect(page).toMatchObject({ items: [], total: 5, page: 10 });
    });

    it('counts only the rows matching the filters', async () => {
      const page = await listEmployees(testPrisma, query({ countryCodes: ['IN'], pageSize: 1 }));

      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(2);
    });
  });

  describe('employment status', () => {
    it('shows current employees by default', async () => {
      expect(await names({ search: 'olivia' })).toEqual([]);
      expect((await listEmployees(testPrisma, query())).total).toBe(5);
    });

    it('shows only current employees when asked for "active"', async () => {
      expect((await listEmployees(testPrisma, query({ status: 'active' }))).total).toBe(5);
    });

    it('shows only former employees when asked for "left"', async () => {
      const page = await listEmployees(testPrisma, query({ status: 'left' }));

      expect(page.items.map((employee) => employee.fullName)).toEqual(['Olivia Left']);
      expect(page.items[0]).toMatchObject({ status: 'left', leftOn: '2025-01-31' });
    });

    it('shows everyone when asked for "all"', async () => {
      const page = await listEmployees(testPrisma, query({ status: 'all' }));

      expect(page.total).toBe(6);
      expect(page.items.find((employee) => employee.fullName === 'Olivia Left')).toMatchObject({
        status: 'left',
        leftOn: '2025-01-31',
      });
    });

    it('combines the status with other filters', async () => {
      expect(await names({ status: 'left', countryCodes: ['GB'] })).toEqual(['Olivia Left']);
      expect(await names({ status: 'left', countryCodes: ['US'] })).toEqual([]);
    });
  });

  it('returns each employee with total salary and currency', async () => {
    const asha = (await listEmployees(testPrisma, query({ search: 'asha' }))).items[0]!;
    await replaceSalaryComponents(testPrisma, asha.id, [
      { code: 'BASIC', annualAmount: 1_200_000 },
      { code: 'TRANSPORT', annualAmount: 19_200 },
    ]);

    const [listed] = (await listEmployees(testPrisma, query({ search: 'asha' }))).items;

    expect(listed).toEqual({
      id: asha.id,
      ...people[0],
      status: 'active',
      leftOn: null,
      currency: 'INR',
      totalSalary: 1_219_200,
    });
  });
});
