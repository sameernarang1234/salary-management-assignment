import type { SalaryComponent, SalaryComponentCode, SalaryComponentType } from '../../../api/types';

/** What the HR Manager has typed into each component field. */
export type ComponentAmounts = Partial<Record<SalaryComponentCode, string>>;

export type ComponentErrors = Partial<Record<SalaryComponentCode, string>>;

/** Same limit as the server (fits a PostgreSQL int when five components are added up). */
export const MAX_COMPONENT_AMOUNT = 100_000_000;

/** "12,00,000" or "1 200 000" → 1200000; null if it is not a whole number. */
function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '');
  return /^\d+$/.test(cleaned) ? Number(cleaned) : null;
}

/**
 * Turns the form into components in catalogue order, skipping blank optional fields.
 * Mirrors the server's rules so most mistakes are caught before sending.
 */
export function componentsFromAmounts(
  amounts: ComponentAmounts,
  catalogue: readonly SalaryComponentType[],
): { components: SalaryComponent[]; errors: ComponentErrors } {
  const components: SalaryComponent[] = [];
  const errors: ComponentErrors = {};

  for (const { code, name, required } of catalogue) {
    const text = (amounts[code] ?? '').trim();
    if (!text) {
      if (required) {
        errors[code] = `${name} is required`;
      }
      continue;
    }
    const amount = parseAmount(text);
    if (amount === null || amount <= 0) {
      errors[code] = 'Enter a whole number greater than 0';
    } else if (amount > MAX_COMPONENT_AMOUNT) {
      errors[code] = `Must be at most ${MAX_COMPONENT_AMOUNT.toLocaleString('en-US')}`;
    } else {
      components.push({ code, annualAmount: amount });
    }
  }
  return { components, errors };
}

export function amountsFromComponents(components: readonly SalaryComponent[]): ComponentAmounts {
  return Object.fromEntries(
    components.map(({ code, annualAmount }) => [code, String(annualAmount)]),
  );
}

/** The running total as the HR Manager types (invalid fields count as 0). */
export function totalOf(amounts: ComponentAmounts): number {
  return Object.values(amounts).reduce((total, text) => total + (parseAmount(text ?? '') ?? 0), 0);
}

export function isSameSalary(
  current: readonly SalaryComponent[],
  next: readonly SalaryComponent[],
): boolean {
  const currentAmounts = new Map(current.map(({ code, annualAmount }) => [code, annualAmount]));
  return (
    current.length === next.length &&
    next.every(({ code, annualAmount }) => currentAmounts.get(code) === annualAmount)
  );
}

/**
 * Maps the server's field errors back onto the form: "components.1.annualAmount" refers to the
 * second component that was sent; "components" is about the salary as a whole.
 */
export function componentErrorsFromServer(
  fields: Record<string, string>,
  submitted: readonly SalaryComponent[],
): { byCode: ComponentErrors; general?: string } {
  const byCode: ComponentErrors = {};
  let general: string | undefined;
  for (const [key, message] of Object.entries(fields)) {
    const match = /^components\.(\d+)\./.exec(key);
    const code = match ? submitted[Number(match[1])]?.code : undefined;
    if (code) {
      byCode[code] ??= message;
    } else if (key === 'components') {
      general = message;
    }
  }
  return general === undefined ? { byCode } : { byCode, general };
}
