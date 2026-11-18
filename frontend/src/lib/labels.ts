import type { SalaryHistoryReason } from '../api/types';

export const REASON_LABELS: Record<SalaryHistoryReason, string> = {
  new_hire: 'New hire',
  annual_increment: 'Annual increment',
  promotion: 'Promotion',
  correction: 'Correction',
  other: 'Other',
};
