import { beforeAll, describe, expect, it } from 'vitest';
import { REFERENCE_COUNTRIES } from '../../src/referenceData/countries.js';
import { generateEmployees, type GeneratedEmployee } from '../../src/seed/generate.js';
import { employeeInputSchema } from '../../src/validators/employee.js';
import { salaryComponentsSchema, salaryTotal } from '../../src/validators/salaryComponents.js';

const TODAY = '2026-10-31';
let employees: GeneratedEmployee[];

beforeAll(() => {
  employees = generateEmployees({ count: 10_000, seed: 42, today: TODAY });
});

describe('generateEmployees', () => {
  it('generates the requested number of employees', () => {
    expect(employees).toHaveLength(10_000);
  });

  it('generates exactly the same data for the same seed', () => {
    const again = generateEmployees({ count: 200, seed: 42, today: TODAY });

    expect(again).toEqual(employees.slice(0, 200));
  });

  it('generates different data for a different seed', () => {
    const other = generateEmployees({ count: 200, seed: 7, today: TODAY });

    expect(other).not.toEqual(employees.slice(0, 200));
  });

  it('gives every employee details that pass the API validation', () => {
    const invalid = employees.filter(
      (employee) => !employeeInputSchema.safeParse(employee.details).success,
    );

    expect(invalid).toEqual([]);
  });

  it('gives every employee salary components that pass the API validation', () => {
    const invalid = employees.filter(
      (employee) => !salaryComponentsSchema.safeParse(employee.components).success,
    );

    expect(invalid).toEqual([]);
  });

  it('gives every employee a unique email, ignoring case', () => {
    const emails = new Set(employees.map((employee) => employee.details.email.toLowerCase()));

    expect(emails.size).toBe(employees.length);
  });

  it('uses only the reference countries, and employs people in all of them', () => {
    const used = new Set(employees.map((employee) => employee.details.countryCode));

    expect([...used].sort()).toEqual(REFERENCE_COUNTRIES.map((country) => country.code).sort());
  });

  it('starts each history with a new_hire entry on the hire date', () => {
    for (const { details, history } of employees) {
      expect(history[0]).toMatchObject({
        reason: 'new_hire',
        effectiveDate: details.hireDate,
        previousComponents: null,
        previousTotal: null,
      });
    }
  });

  it('chains each history entry to the one before, ending at the current salary', () => {
    // Problems are collected and asserted once: 10,000 histories make per-entry expects slow.
    const problems: string[] = [];
    for (const { details, components, history } of employees) {
      history.forEach((entry, index) => {
        if (entry.newTotal !== salaryTotal(entry.newComponents)) {
          problems.push(`${details.email}: entry ${index} total does not match its components`);
        }
        if (index === 0) {
          return;
        }
        const previous = history[index - 1]!;
        if (JSON.stringify(entry.previousComponents) !== JSON.stringify(previous.newComponents)) {
          problems.push(`${details.email}: entry ${index} previous components break the chain`);
        }
        if (entry.previousTotal !== previous.newTotal) {
          problems.push(`${details.email}: entry ${index} previous total breaks the chain`);
        }
        if (entry.effectiveDate < previous.effectiveDate) {
          problems.push(`${details.email}: entry ${index} is dated before the previous one`);
        }
        if (entry.reason === 'new_hire') {
          problems.push(`${details.email}: entry ${index} is a second new_hire`);
        }
      });
      if (JSON.stringify(history.at(-1)?.newComponents) !== JSON.stringify(components)) {
        problems.push(`${details.email}: current salary is not the last history entry`);
      }
    }

    expect(problems).toEqual([]);
  });

  it('never dates anything after today', () => {
    for (const { details, history, leftOn } of employees) {
      expect(details.hireDate <= TODAY).toBe(true);
      expect(history.every((entry) => entry.effectiveDate <= TODAY)).toBe(true);
      expect(leftOn === null || leftOn <= TODAY).toBe(true);
    }
  });

  it('marks a few employees as left, after their last salary change', () => {
    const leavers = employees.filter((employee) => employee.leftOn !== null);

    expect(leavers.length).toBeGreaterThan(300);
    expect(leavers.length).toBeLessThan(800);
    for (const { history, leftOn } of leavers) {
      expect(leftOn! >= history.at(-1)!.effectiveDate).toBe(true);
    }
  });

  it('gives most employees some salary history beyond their hire', () => {
    const withChanges = employees.filter((employee) => employee.history.length > 1);

    expect(withChanges.length / employees.length).toBeGreaterThan(0.6);
  });

  it('includes allowances, not only Basic', () => {
    const codes = new Set(employees.flatMap((employee) => employee.components.map((c) => c.code)));

    expect([...codes].sort()).toEqual(['BASIC', 'HOUSING', 'HRA', 'SPECIAL', 'TRANSPORT']);
  });
});
