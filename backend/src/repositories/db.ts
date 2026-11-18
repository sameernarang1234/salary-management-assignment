import type { Prisma, PrismaClient } from '../generated/prisma/client.js';

/** The Prisma client, or a transaction client inside `prisma.$transaction`. */
export type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Runs `work` in a transaction. If `db` is already a transaction client, it joins that
 * transaction, so a service can combine several repository calls into one.
 */
export function inTransaction<T>(
  db: Db,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return '$transaction' in db ? db.$transaction(work) : work(db);
}

/** A PostgreSQL `date` arrives as midnight UTC; this returns its YYYY-MM-DD form. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
