import type { Db } from './db.js';

export interface FilterOptions {
  departments: string[];
  jobTitles: string[];
}

/** Distinct departments and job titles of active employees, for the directory filters. */
export async function getFilterOptions(db: Db): Promise<FilterOptions> {
  const [departments, jobTitles] = await Promise.all([
    db.employee.findMany({
      where: { status: 'active' },
      distinct: ['department'],
      select: { department: true },
      orderBy: { department: 'asc' },
    }),
    db.employee.findMany({
      where: { status: 'active' },
      distinct: ['jobTitle'],
      select: { jobTitle: true },
      orderBy: { jobTitle: 'asc' },
    }),
  ]);

  return {
    departments: departments.map((row) => row.department),
    jobTitles: jobTitles.map((row) => row.jobTitle),
  };
}
