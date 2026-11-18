import { Prisma } from '../generated/prisma/client.js';
import type { SalaryChangeReason } from '../validators/salaryChange.js';
import { salaryComponentsSchema, type SalaryComponent } from '../validators/salaryComponents.js';
import { fromIsoDate, toIsoDate, type Db } from './db.js';

export type SalaryHistoryReason = 'new_hire' | SalaryChangeReason;

export interface NewSalaryHistoryEntry {
  employeeId: number;
  effectiveDate: string;
  reason: SalaryHistoryReason;
  /** null only for new_hire */
  previousComponents: SalaryComponent[] | null;
  /** null only for new_hire */
  previousTotal: number | null;
  newComponents: SalaryComponent[];
  newTotal: number;
}

export interface SalaryHistoryEntry extends NewSalaryHistoryEntry {
  id: number;
  /** When the change was recorded, as an ISO timestamp. */
  recordedAt: string;
}

type HistoryRow = Prisma.SalaryHistoryEntryGetPayload<object>;

/** Stored snapshots are validated on the way out, so a corrupted row fails loudly. */
function toEntry(row: HistoryRow): SalaryHistoryEntry {
  return {
    id: row.id,
    employeeId: row.employeeId,
    effectiveDate: toIsoDate(row.effectiveDate),
    reason: row.reason,
    previousComponents:
      row.previousComponents === null ? null : salaryComponentsSchema.parse(row.previousComponents),
    previousTotal: row.previousTotal,
    newComponents: salaryComponentsSchema.parse(row.newComponents),
    newTotal: row.newTotal,
    recordedAt: row.recordedAt.toISOString(),
  };
}

/** Appends an entry. History is append-only: there is no update or delete. */
export async function appendSalaryHistory(
  db: Db,
  entry: NewSalaryHistoryEntry,
): Promise<SalaryHistoryEntry> {
  const row = await db.salaryHistoryEntry.create({
    data: {
      employeeId: entry.employeeId,
      effectiveDate: fromIsoDate(entry.effectiveDate),
      reason: entry.reason,
      previousComponents: entry.previousComponents ?? Prisma.DbNull,
      previousTotal: entry.previousTotal,
      newComponents: entry.newComponents,
      newTotal: entry.newTotal,
    },
  });
  return toEntry(row);
}

/** An employee's salary history, newest first (by effective date, then by when recorded). */
export async function listSalaryHistory(db: Db, employeeId: number): Promise<SalaryHistoryEntry[]> {
  const rows = await db.salaryHistoryEntry.findMany({
    where: { employeeId },
    orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
  });
  return rows.map(toEntry);
}
